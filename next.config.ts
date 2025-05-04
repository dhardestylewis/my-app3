/** @type {import('next').NextConfig} */
const nextConfig = {
  // turn off browser sourcemaps so calls to *.js.map are not emitted
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
