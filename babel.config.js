module.exports = function(api) {
  const isTest = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    // Tests intentionally mock the public package. Device bundles use direct
    // imports, validated separately against the installed export map.
    plugins: isTest ? [] : [require.resolve('./scripts/babel/selectLucideImports.cjs')],
  };
};
