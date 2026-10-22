import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('protected console uses verified role and refreshes all consumers together', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [], entries: [] } });
  const previous = { localStorage: globalThis.localStorage, window: globalThis.window };
  let tree;
  try {
    const values = new Map([['ndfa_token', 'test-token'], ['ndfa_user', '{invalid cached data']]);
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
    const listeners = new Map();
    globalThis.window = { addEventListener: (k,fn) => listeners.set(k,fn), removeEventListener: k => listeners.delete(k) };
    const { default: VerifiedSession, useSession } = await server.ssrLoadModule('/src/auth/Session.jsx');
    const { authApi } = await server.ssrLoadModule('/src/api/api.js');
    let resolve;
    authApi.me = () => new Promise(r => { resolve = r; });
    function Consumer() { const { user } = useSession(); return React.createElement('span', null, user.role); }
    await act(async () => { tree = create(React.createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      React.createElement(VerifiedSession, null, React.createElement(Consumer), React.createElement(Consumer)))); });
    assert.equal(tree.root.findAllByType('span').length, 0, 'cached data must never open a protected page');
    await act(async () => resolve({ data: { id: 'platform', role: 'superAdmin' } }));
    assert.deepEqual(tree.root.findAllByType('span').map(n => n.children[0]), ['superAdmin', 'superAdmin']);
    assert.equal(JSON.parse(values.get('ndfa_user')).role, 'superAdmin');
    authApi.me = async () => ({ data: { id: 'platform', role: 'admin' } });
    await act(async () => listeners.get('focus')());
    assert.deepEqual(tree.root.findAllByType('span').map(n => n.children[0]), ['admin', 'admin']);
    authApi.me = async () => { throw { status: 403, message: 'Account is disabled' }; };
    await act(async () => listeners.get('focus')());
    assert.equal(values.has('ndfa_token'), false);
    assert.equal(tree.root.findAllByType('span').length, 0);
  } finally {
    if (tree) await act(async () => tree.unmount());
    await server.close();
    globalThis.localStorage = previous.localStorage;
    globalThis.window = previous.window;
  }
});
