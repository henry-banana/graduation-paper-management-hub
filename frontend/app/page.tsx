export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">HCM-UTE Graduation Management</h1>
      <p className="text-gray-600 mb-8">Hệ thống quản lý BCTT và KLTN</p>
      <a href="/login" className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
        Đăng nhập
      </a>
    </main>
  );
}
