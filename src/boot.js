'use strict';
/* Boot: render immediately, then light up the runtime capabilities when the viewer answers. */
(async function boot() {
  UI.bind();
  const caps = { sample: null, db: null, assets: null, downloads: null, limits: null };
  const use = (name) => {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
      return Promise.race([window.claude.use(name), new Promise((r) => setTimeout(() => r(null), 12000))]).catch(() => null);
    } catch (e) { return Promise.resolve(null); }
  };
  const [sample, db, assets, downloads] = await Promise.all([use('sample'), use('db'), use('assets'), use('downloads')]);
  caps.sample = sample; caps.db = db; caps.assets = assets; caps.downloads = downloads;
  if (sample && typeof sample.limits === 'function') caps.limits = await sample.limits().catch(() => null);
  if (!caps.limits) caps.limits = { maxPromptBytes: 65536 };
  await UI.start(caps);
})();
