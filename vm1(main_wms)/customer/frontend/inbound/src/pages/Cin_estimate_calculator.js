import React, { useEffect } from "react";

const Cin_estimate_calculator = ({ formData, onQuoteCalculated }) => {
  // formData가 없을 때도 훅은 호출되지만, 내부에서 조건문을 통해 아무 것도 하지 않음.
  
  // 데이터 계산 로직도 formData가 있을 때만 의미 있으므로 조건부 처리
  let inbound_size = "대";
  let pallet_count = 1;
  let total_weight = 0;
  let storage_duration = 0;
  let total_cost = 0;

  if (formData) {
    const { width_size, height_size, length_size, inbound_quantity } = formData;

    if (width_size <= 500 && height_size <= 400 && length_size <= 500) {
      inbound_size = "소";
      pallet_count = Math.ceil(inbound_quantity / 8);
    } else if (width_size <= 900 && height_size <= 800 && length_size <= 900) {
      inbound_size = "중";
      pallet_count = Math.ceil(inbound_quantity / 4);
    }

    total_weight = formData.each_weight * formData.inbound_quantity || 0;
    storage_duration =
      Math.ceil(
        (new Date(formData.outbound_date) -
          new Date(formData.subscription_inbound_date)) /
          (1000 * 60 * 60 * 24)
      ) || 0;
    total_cost = pallet_count * storage_duration * 100 || 0;
  }

  const quoteResult = {
    inbound_size,
    pallet_count,
    total_weight,
    storage_duration,
    total_cost,
  };

  useEffect(() => {
    if (formData && onQuoteCalculated) {
      onQuoteCalculated(quoteResult);
    }
  }, [quoteResult, onQuoteCalculated, formData]);

  // formData가 없으면 UI 렌더링 X
  if (!formData) {
    return null;
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>견적 결과</h3>
      <p>물품 크기: {inbound_size}</p>
      <p>팔레트 개수: {pallet_count}</p>
      <p>총 무게: {total_weight}kg</p>
      <p>보관 기간: {storage_duration}일</p>
      <p>총 비용: {total_cost}원</p>
    </div>
  );
};

export default Cin_estimate_calculator;
