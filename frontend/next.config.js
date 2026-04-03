/** @type {import('next').NextConfig} */
const nextConfig = {
	// output: 'standalone', // Disabled to allow direct 'npm run start' without node server.js
	eslint: {
		// Only lint these directories during build (excludes node_modules)
		dirs: ['app', 'components', 'lib', 'hooks'],
	},
};
module.exports = nextConfig;
