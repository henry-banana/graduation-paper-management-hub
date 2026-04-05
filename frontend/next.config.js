/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone', // ✅ Enabled for optimized Docker builds (80% smaller image)
};
module.exports = nextConfig;
