/**
 * FACE MATCH — server-side face recognition for attendance.
 * Detects the face in each photo, turns it into a 128-number face signature,
 * and compares the live selfie against the employee's enrolled photos.
 */
const fs = require('fs');
const path = require('path');
const { normalizeRecordingUrl } = require('./mediaUrl');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const DESCRIPTOR_VERSION = 1;
/** Same person is usually under 0.45; different people are usually above 0.55. */
const MATCH_DISTANCE = 0.48;
/** Enrolled photos must agree with each other this closely. */
const ENROLLMENT_CONSISTENCY = 0.55;
const MIN_FACE_PX = 60;
const MAX_IMAGE_PX = 800;

let faceapiPromise = null;
let queue = Promise.resolve();

class FaceCheckError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function loadFaceApi() {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const wasm = require('@tensorflow/tfjs-backend-wasm');
      const wasmDir = path.join(path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')), 'dist');
      wasm.setWasmPaths(`${wasmDir}${path.sep}`);
      const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
      await faceapi.tf.setBackend('wasm');
      await faceapi.tf.ready();
      const modelDir = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);
      return faceapi;
    })().catch((err) => {
      faceapiPromise = null;
      throw err;
    });
  }
  return faceapiPromise;
}

function warmUp() {
  loadFaceApi()
    .then(() => console.log('  Face match: ready'))
    .catch((err) => console.error('❌ Face match failed to load:', err.message));
}

/** One image at a time keeps memory flat on a small server. */
function serial(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/** `padded` adds a grey border so a face that fills the whole frame can still be found. */
async function imageToTensor(faceapi, buffer, padded = false) {
  const sharp = require('sharp');
  let decoded;
  try {
    let pipeline = sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_IMAGE_PX, height: MAX_IMAGE_PX, fit: 'inside', withoutEnlargement: true });
    if (padded) {
      const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
      const longest = Math.min(MAX_IMAGE_PX, Math.max(meta.width || 0, meta.height || 0));
      const border = Math.round(longest * 0.3);
      pipeline = sharp(
        await pipeline.toBuffer(),
        { failOn: 'none' }
      ).extend({ top: border, bottom: border, left: border, right: border, background: { r: 128, g: 128, b: 128 } });
    }
    decoded = await pipeline
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new FaceCheckError('Photo could not be read — take the selfie again', 'bad_image');
  }
  const { data, info } = decoded;
  if (info.channels !== 3) {
    throw new FaceCheckError('Photo could not be read — take the selfie again', 'bad_image');
  }
  return faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
}

/**
 * Returns the one clear face in the photo, or throws a FaceCheckError
 * when there is no face, the face is too small, or two people are in frame.
 */
function describeFace(buffer) {
  return serial(async () => {
    const faceapi = await loadFaceApi();
    const detect = async (padded) => {
      const tensor = await imageToTensor(faceapi, buffer, padded);
      try {
        return await faceapi
          .detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
      } finally {
        tensor.dispose();
      }
    };
    let results = await detect(false);
    if (!results.length) results = await detect(true);

    const faces = results
      .map((r) => ({ box: r.detection.box, score: r.detection.score, descriptor: r.descriptor }))
      .sort((a, b) => b.box.area - a.box.area);
    if (!faces.length) {
      throw new FaceCheckError('No face found — keep your face in the centre, in good light', 'no_face');
    }
    const main = faces[0];
    if (Math.min(main.box.width, main.box.height) < MIN_FACE_PX) {
      throw new FaceCheckError('Face is too far — hold the phone closer', 'face_small');
    }
    if (faces.length > 1 && faces[1].box.area >= main.box.area * 0.35) {
      throw new FaceCheckError('Only one person should be in the selfie', 'many_faces');
    }
    return {
      descriptor: Array.from(main.descriptor, (v) => Math.round(v * 1e5) / 1e5),
      detectionScore: Math.round(main.score * 1000) / 1000,
    };
  });
}

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function readUploadedPhoto(url) {
  const normalized = normalizeRecordingUrl(url);
  if (!normalized) return null;
  const filename = path.basename(normalized);
  const absolute = path.join(UPLOAD_DIR, filename);
  if (!absolute.startsWith(UPLOAD_DIR) || !fs.existsSync(absolute)) return null;
  return fs.readFileSync(absolute);
}

/**
 * Builds face signatures for enrollment photos and checks they all show
 * the same single person.
 */
async function buildEnrollment(urls) {
  const descriptors = [];
  for (let i = 0; i < urls.length; i += 1) {
    const buffer = readUploadedPhoto(urls[i]);
    if (!buffer) {
      throw new FaceCheckError(`Face photo ${i + 1} is missing on the server — capture it again`, 'missing_photo');
    }
    try {
      const { descriptor } = await describeFace(buffer);
      descriptors.push(descriptor);
    } catch (err) {
      if (err instanceof FaceCheckError) {
        throw new FaceCheckError(`Face photo ${i + 1}: ${err.message}`, err.code);
      }
      throw err;
    }
  }
  for (let i = 0; i < descriptors.length; i += 1) {
    for (let j = i + 1; j < descriptors.length; j += 1) {
      if (distance(descriptors[i], descriptors[j]) > ENROLLMENT_CONSISTENCY) {
        throw new FaceCheckError('Face photos are not of the same person — capture all 3 again', 'mixed_people');
      }
    }
  }
  return descriptors;
}

/**
 * Compares a live face with the enrolled faces. A match needs the closest
 * photo under the limit and most of the enrolled photos agreeing.
 */
function compare(liveDescriptor, enrolledDescriptors) {
  const distances = enrolledDescriptors.map((d) => distance(liveDescriptor, d)).sort((a, b) => a - b);
  const best = distances[0];
  const needed = Math.ceil(distances.length / 2);
  const agreeing = distances.filter((d) => d <= MATCH_DISTANCE + 0.05).length;
  const matched = best <= MATCH_DISTANCE && agreeing >= needed;
  const score = Math.max(0, Math.min(1, 1 - best / 1.2));
  return {
    matched,
    distance: Math.round(best * 1000) / 1000,
    matchScore: Math.round(score * 100) / 100,
  };
}

function enrollmentUrls(user) {
  return Array.isArray(user?.faceEnrollmentUrls) ? user.faceEnrollmentUrls : [];
}

/** Enrollment counts only when 3+ photos exist and they were not found unusable. */
function isEnrollmentComplete(user) {
  return enrollmentUrls(user).length >= 3 && user.faceEnrollmentValid !== false;
}

/** Face fields that must never leave the server. */
function stripFaceSecrets(user) {
  const {
    faceEnrollmentUrls,
    faceDescriptors,
    faceDescriptorUrls,
    faceDescriptorVersion,
    faceVerification,
    faceVerifyFailures,
    faceEnrollmentValid,
    faceEnrollmentProblem,
    ...safe
  } = user;
  const count = enrollmentUrls(user).length;
  safe.faceEnrollmentComplete = isEnrollmentComplete(user);
  safe.faceEnrollmentCount = count;
  return safe;
}

/**
 * Face signatures for the user's enrolled photos, built once and kept on the
 * user record. Marks the enrollment unusable when the photos fail the check.
 */
async function ensureEnrolledDescriptors(user, save) {
  const urls = enrollmentUrls(user);
  const key = urls.join('|');
  if (
    Array.isArray(user.faceDescriptors) &&
    user.faceDescriptors.length >= 3 &&
    user.faceDescriptorVersion === DESCRIPTOR_VERSION &&
    user.faceDescriptorUrls === key
  ) {
    return user.faceDescriptors;
  }
  try {
    const descriptors = await buildEnrollment(urls);
    user.faceDescriptors = descriptors;
    user.faceDescriptorUrls = key;
    user.faceDescriptorVersion = DESCRIPTOR_VERSION;
    user.faceEnrollmentValid = true;
    delete user.faceEnrollmentProblem;
    save(user);
    return descriptors;
  } catch (err) {
    if (err instanceof FaceCheckError) {
      user.faceEnrollmentValid = false;
      user.faceEnrollmentProblem = err.message;
      delete user.faceDescriptors;
      save(user);
    }
    throw err;
  }
}

module.exports = {
  DESCRIPTOR_VERSION,
  FaceCheckError,
  warmUp,
  describeFace,
  buildEnrollment,
  compare,
  distance,
  isEnrollmentComplete,
  stripFaceSecrets,
  ensureEnrolledDescriptors,
};
