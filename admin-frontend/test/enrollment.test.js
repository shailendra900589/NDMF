import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createServer } from 'vite';

test('registration photos follow employee selection and ignore stale responses', async () => {
  const server = await createServer({configFile:false,esbuild:{jsx:'automatic'},server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
  let tree;
  try {
    const {default: EnrollmentPhotos} = await server.ssrLoadModule('/src/components/EnrollmentPhotos.jsx');
    const {attendanceApi} = await server.ssrLoadModule('/src/api/api.js');
    const pending = {};
    attendanceApi.getEnrollment = id => new Promise(resolve => { pending[id] = resolve; });
    await act(async () => { tree = create(React.createElement(EnrollmentPhotos,{userId:'A',name:'Employee A'})); });
    assert.ok(JSON.stringify(tree.toJSON()).includes('Loading registration photos'));
    await act(async () => tree.update(React.createElement(EnrollmentPhotos,{userId:'B',name:'Employee B'})));
    await act(async () => pending.B({data:{complete:true,photos:['/uploads/B.png?signature=test'],enrolledAt:null}}));
    assert.equal(tree.root.findByType('img').props.src, '/uploads/B.png?signature=test');
    await act(async () => pending.A({data:{complete:true,photos:['/uploads/A.png']}}));
    assert.equal(tree.root.findByType('img').props.src, '/uploads/B.png?signature=test');
    await act(async () => tree.update(React.createElement(EnrollmentPhotos,{userId:'C',name:'Employee C'})));
    await act(async () => pending.C({data:{complete:false,photos:[]}}));
    assert.equal(tree.root.findAllByType('img').length, 0);
    assert.ok(JSON.stringify(tree.toJSON()).includes('No registration photos'));
  } finally {
    if (tree) await act(async () => tree.unmount());
    await server.close();
  }
});
