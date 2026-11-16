module.exports = function (api) {
  api.cache(true);
  return {
    // zustand v5 usa `import.meta`, que el bundle web (script clásico) no soporta.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
