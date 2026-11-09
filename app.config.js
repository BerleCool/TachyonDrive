module.exports = ({ config }) => {
  const standalone = process.env.TACHYON_STANDALONE === '1';
  return {
    ...config,
    name: standalone ? 'Tachyon Drive' : 'Tachyon Dev',
    android: { ...config.android, package: standalone ? 'net.gideonai.tachyondrive.standalone' : 'net.gideonai.tachyondrive' },
  };
};
