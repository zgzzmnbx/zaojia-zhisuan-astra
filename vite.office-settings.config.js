import host from './vite.config.js';

// These pages run as separate documents. Keep their shared styles out of the workbench bundle.
export default {
  ...host,
  build: {
    ...host.build,
    emptyOutDir: false,
    copyPublicDir: false,
    rolldownOptions: {input: ['office-tasks.html', 'office-settings.html']},
  },
};
