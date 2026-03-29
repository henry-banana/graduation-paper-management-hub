"use client";

import { Calendar, MapPin, MonitorPlay, Plus } from "lucide-react";
import { MOCK_SCHEDULES } from "../mock-data";

export default function TBMSchedulesPage() {
  const handleNotify = () => {
    alert("Gửi email và in-app notification nhắc lịch cho toàn bộ SV, GVHD, GVPB, và Hội đồng.");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Lịch bảo vệ KLTN</h1>
          <p className="text-sm text-gray-500">Quản lý không gian, thời gian và địa điểm bảo vệ cho các hội đồng.</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" /> Thêm lịch mới
        </button>
      </div>

      <div className="bg-white border rounded-lg shadow-sm">
        <div className="divide-y divide-gray-200">
          {MOCK_SCHEDULES.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Không có lịch bảo vệ nào được lên.
            </div>
          ) : MOCK_SCHEDULES.map((schedule) => (
            <div key={schedule.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50 transition-colors">
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {schedule.topicName}
                  </h3>
                   <span className={`ml-4 shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      schedule.type === "ONLINE" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {schedule.type}
                    </span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center font-medium text-gray-900">
                    SV: {schedule.studentName}
                  </div>
                  <div className="hidden sm:block text-gray-300">|</div>
                  <div className="flex items-center text-blue-600 font-medium">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    {new Date(schedule.defenseDate).toLocaleString("vi-VN", { dateStyle: "full", timeStyle: "short" })}
                  </div>
                  <div className="hidden sm:block text-gray-300">|</div>
                  <div className="flex items-center">
                    {schedule.type === "ONLINE" ? (
                      <MonitorPlay className="w-4 h-4 mr-1.5 text-gray-400" />
                    ) : (
                      <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                    )}
                    {schedule.location}
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col gap-3">
                <button 
                  onClick={handleNotify}
                  className="flex-1 md:flex-none justify-center inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 md:mt-0"
                >
                  Nhắc lịch (Notify)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
