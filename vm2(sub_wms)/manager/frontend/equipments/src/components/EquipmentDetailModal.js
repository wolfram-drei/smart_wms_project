import React from "react";
import { Dialog } from "@headlessui/react";

const EquipmentDetailModal = ({ isOpen, onClose, data }) => {
  if (!data) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <Dialog.Panel className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full">
          <Dialog.Title className="text-lg font-bold mb-4">{data.equipment_name}</Dialog.Title>
          <div className="space-y-2">
            <div><strong>모델:</strong> {data.model}</div>
            <div><strong>제조사:</strong> {data.manufacturer}</div>
            <div><strong>상태:</strong> {data.status}</div>
            <div><strong>위치:</strong> {data.location}</div>
            <div><strong>담당자:</strong> {data.assigned_to}</div>
            <div><strong>다음 점검일:</strong> {data.next_maintenance_date}</div>
            {/* 필요하면 더 추가 */}
          </div>
          <div className="mt-6 text-right">
            <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded">
              닫기
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default EquipmentDetailModal;
