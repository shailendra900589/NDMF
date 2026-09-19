/**
 * LEADS CONTROLLER
 * ----------------
 * Field Officer leads accept karta hai, Admin panel se manage hota hai.
 */
const { v4: uuid } = require('uuid');
const { getCollection, saveCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');

exports.getAll = (req, res) => {
  let leads = getCollection('leads');
  const { status, search } = req.query;

  if (status) leads = leads.filter((l) => l.status === status);
  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(
      (l) => l.name.toLowerCase().includes(q) || l.mobile.includes(q)
    );
  }

  return success(res, leads);
};

exports.getById = (req, res) => {
  const lead = findById('leads', req.params.id);
  if (!lead) return error(res, 'Lead not found', 404);
  return success(res, lead);
};

exports.create = (req, res) => {
  const lead = {
    id: `LEAD_${uuid().slice(0, 8)}`,
    ...req.body,
    status: 'newLead',
    createdAt: new Date().toISOString(),
    assignedTo: null,
  };
  upsert('leads', lead);
  return success(res, lead, 'Lead created', 201);
};

exports.accept = (req, res) => {
  const { leadId } = req.body;
  const lead = findById('leads', leadId);
  if (!lead) return error(res, 'Lead not found', 404);

  lead.status = 'accepted';
  lead.assignedTo = req.user.employeeId;
  upsert('leads', lead);
  return success(res, lead, 'Lead accepted');
};

exports.updateStatus = (req, res) => {
  const lead = findById('leads', req.params.id);
  if (!lead) return error(res, 'Lead not found', 404);

  lead.status = req.body.status;
  if (req.body.notes) lead.notes = req.body.notes;
  upsert('leads', lead);
  return success(res, lead);
};
