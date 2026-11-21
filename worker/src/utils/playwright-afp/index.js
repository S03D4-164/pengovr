import pkg from './src/index.cjs';
const { protectIt } = pkg;

export const getProtectIt = async () => {
  return protectIt;
};

export { protectIt };
