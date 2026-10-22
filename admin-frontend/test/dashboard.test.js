import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('admin dashboard respects disabled tracking and displays API failures with retry', async () => {
  const server = await createServer({
    configFile: false, esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    plugins: [{ name: 'test-map', enforce: 'pre', load(id) {
      if (id.replaceAll('\\', '/').endsWith('/components/LiveTeamMap.jsx')) return 'export default function TestMap() { return null; }';
    } }],
  });
  const previous = { localStorage: globalThis.localStorage, window: globalThis.window };
  let tree;
  try {
    const values = new Map([['ndfa_token', 'test-token']]);
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    const { default: VerifiedSession } = await server.ssrLoadModule('/src/auth/Session.jsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/pages/Dashboard.jsx');
    const { authApi, dashboardApi, trackingApi } = await server.ssrLoadModule('/src/api/api.js');
    authApi.me = async () => ({data:{id:'dummy-admin',role:'admin',permissions:{tracking:false}}});
    let mapRequests = 0;
    trackingApi.getLive = async () => { mapRequests++; return {data:[]}; };
    dashboardApi.getStats = async () => { throw {message:'Temporary API failure'}; };
    await act(async () => { tree = create(React.createElement(MemoryRouter, {future:{v7_startTransition:true,v7_relativeSplatPath:true}},
      React.createElement(VerifiedSession, null, React.createElement(Dashboard)))); });
    assert.equal(tree.root.findByProps({role:'alert'}).findByType('p').children[0], 'Temporary API failure');
    assert.equal(mapRequests, 0, 'admin role must not override tracking policy');
    dashboardApi.getStats = async () => ({data:{scope:'all_branches',branchCount:0,teamMembers:1}});
    await act(async () => tree.root.findByType('button').props.onClick());
    assert.equal(tree.root.findAllByProps({role:'alert'}).length, 0);
    const output = JSON.stringify(tree.toJSON());
    assert.ok(output.includes('Organization-wide view'));
    assert.ok(output.includes('Team members'));
    assert.ok(!output.includes('Live field map'));
    assert.equal(mapRequests, 0);
  } finally {
    if (tree) await act(async () => tree.unmount());
    await server.close();
    globalThis.localStorage = previous.localStorage;
    globalThis.window = previous.window;
  }
});
