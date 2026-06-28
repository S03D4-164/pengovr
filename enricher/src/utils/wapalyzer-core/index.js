export const getWappalyzerModule = async () => {
  const m = await import('./wappalyzer.cjs');
  return m.default || m;
};

export const getTechnologiesModule = async () => {
  const m = await import('./technologies.json');
  return m.default || m;
};

export const getCategoriesModule = async () => {
  const m = await import('./categories.json');
  return m.default || m;
};
