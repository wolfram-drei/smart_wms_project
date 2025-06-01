import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const API_BASE_URL = "http://34.64.211.3:5003";

const InventoryStatus = () => {
  const [checkboxValues, setCheckboxValues] = useState({
    pallet: false,
    palletRack: false,
  });
  const [dropdownData, setDropdownData] = useState({
    distribution_centers: [],
    functionalities: [],
    regions: [],
  });
  const [selectedDropdown, setSelectedDropdown] = useState({
    center: "",
    functionality: "",
    region: "",
  });
  const [searchFilters, setSearchFilters] = useState({
    lot: false,
    productNumber: false,
    arrivalDate: false,
  });

  const [imageData, setImageData] = useState({ pallet: null, palletRack: null });
  const [tableData, setTableData] = useState([]);
  const [searchText, setSearchText] = useState(""); // 서치바 입력값
  const [rowsPerPage, setRowsPerPage] = useState(10);// 한 번에 출력할 데이터 개수
  const [selectedProductId, setSelectedProductId] = useState(null); // 추가된 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  

  // 데이터 로드 함수
  const fetchDropdownData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dropdown-data`);
      setDropdownData(response.data);
    } catch (err) {
      console.error("Error fetching dropdown data:", err);
      setError("드롭다운 데이터를 불러오는 중 오류가 발생했습니다.");
    }
  }, []);

  const fetchTableData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/products`, {
        params: {
          ...selectedDropdown,
          productNumber: searchFilters.productNumber ? searchText : null,
          arrivalDate: searchFilters.arrivalDate ? searchText : null,
        },
      });
      const fullData = response.data;
  
      console.log("Fetched Table Data:", fullData); // 여기서 데이터 확인
      setTableData(fullData.slice(0, rowsPerPage));
    } catch (err) {
      console.error("Error fetching table data:", err);
      setError("테이블 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedDropdown, searchFilters, searchText, rowsPerPage]);

  const fetchProductImages = useCallback(async (productId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/product-images/${productId}`);
      setImageData(response.data); // product_image와 pallet_image 경로를 저장
    } catch (err) {
      console.error("Error fetching product images:", err);
      setError("상품 이미지를 불러오는 중 오류가 발생했습니다.");
    }
  }, []);

  const fetchImageData = useCallback(async () => {
    try {
      const { pallet, palletRack } = checkboxValues;

      // 파렛트 및 파렛트랙 체크박스가 모두 비활성화 상태라면 요청하지 않음
      if (!pallet && !palletRack) return;

      // 특정 상품이 선택되지 않았다면 요청하지 않음
      if (!selectedProductId) {
        console.log("No product selected, skipping image fetch");
        return;
      }

      // API 호출
      const response = await axios.get(`${API_BASE_URL}/product-images/${selectedProductId}`);
      setImageData(response.data); // 상품 이미지 및 파렛트 이미지를 상태에 저장
    } catch (err) {
      console.error("Error fetching image data:", err);
      setError("이미지 데이터를 불러오는 중 오류가 발생했습니다.");
    }
  }, [checkboxValues, selectedProductId]);

  // 드롭다운 및 체크박스 변경 핸들러
  const handleDropdownChange = (e, field) => {
    setSelectedDropdown({
      ...selectedDropdown,
      [field]: e.target.value,
    });
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    fetchTableData(); // 드롭다운 변경 시 데이터 다시 로드
  };

  const handleCheckboxChange = (e) => {
    setCheckboxValues({
      ...checkboxValues,
      [e.target.name]: e.target.checked,
    });
  };
  const handleSearchFilterChange = (e) => {
    setSearchFilters({
      ...searchFilters,
      [e.target.name]: e.target.checked,
    });
  };
  
  const handleSearch = () => {
    fetchTableData(); // 검색어 및 체크박스 상태를 기반으로 테이블 데이터를 가져옴
  };

  // AG Grid 행 클릭 핸들러
  const handleRowClick = (event) => {
    const productId = event.data.id;
    setSelectedProductId(productId); // selectedProductId 상태 설정
    fetchProductImages(productId); // 이미지를 로드하는 함수 호출
  };

  // 데이터 초기 로드
  useEffect(() => {
    fetchDropdownData();
    fetchTableData();
  }, [fetchDropdownData, fetchTableData]);

  useEffect(() => {
    fetchTableData();
    fetchImageData();
  }, [fetchTableData, fetchImageData]);

  return (
    <div style={{
    backgroundColor:"#ffffff", 
    borderRadius:"10px", 
    width:"96%",
    marginTop:"20px",
    padding:"5px",
    marginLeft:"20px",
    borderRadius: "10px", // 모서리 둥글게
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // 쉐도우 추가
    background: "linear-gradient(135deg, #ffffff, #ffffff)", // 배경 그라데이션
    }}>
    <div style={{ padding: "10px 10px" }}>
      <h3>재고 현황</h3>
      <div style={{width:"98.5%",backgroundColor:"#6f47c5", 
        border:"1px solid #6f47c5",
        marginBottom:"10px"}}></div>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* 드롭다운 및 체크박스 */}
      <div style={{ display: "flex", 
        justifyContent: "space-between", 
        margintop: "20px",
        marginBottom:"20px",
        padding:"0 10px"}}>
        <div style={{ display: "flex", gap: "10px" }}>
          <label>
            <input

              type="checkbox"
              name="pallet"
              checked={checkboxValues.pallet}
              onChange={handleCheckboxChange}
            />
            보관상품
          </label>
          <label>
            <input
              type="checkbox"
              name="palletRack"
              checked={checkboxValues.palletRack}
              onChange={handleCheckboxChange}
            />
            보관위치
          </label>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <select onChange={(e) => handleDropdownChange(e, "center")} value={selectedDropdown.center}>
            <option value="">물류 센터</option>
            {dropdownData.distribution_centers.map((center, index) => (
              <option key={index} value={center}>
                {center}
              </option>
            ))}
          </select>
          <select
            onChange={(e) => handleDropdownChange(e, "functionality")}
            value={selectedDropdown.functionality}
          >
            <option value="">기능별</option>
            {dropdownData.functionalities.map((func, index) => (
              <option key={index} value={func}>
                {func}
              </option>
            ))}
          </select>
          <select onChange={(e) => handleDropdownChange(e, "region")} value={selectedDropdown.region}>
            <option value="">구역별</option>
            {dropdownData.regions.map((region, index) => (
              <option key={index} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
      </div>
      

      {/* 이미지 영역 */}
<div
  style={{
    display: "flex",
    width: "97.5%",
    height: "50vh", // 상하 50% 고정
    border: "1px solid #ddd",
    borderRadius: "10px", // 모서리 둥글게
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // 쉐도우 추가
    background: "linear-gradient(135deg, #f9f9f9, #e6e6e6)", // 배경 그라데이션
    justifyContent: "space-between",
    alignItems: "center", // 수직 정렬
    overflow: "hidden", // 박스 밖으로 삐져나오지 않도록
    marginBottom: "20px",
    padding: "10px", // 내부 여백 추가
  }}
>
  {/* 파렛트 이미지 표시 */}
  {checkboxValues.pallet && imageData.product_image && (
    <div
      style={{
        width: checkboxValues.palletRack ? "50%" : "100%", // 둘 다 있으면 50%, 하나만 있으면 100%
        height: "100%", // 상하 전체 차지
        display: "flex",
        justifyContent: "center", // 이미지 가운데 정렬
        alignItems: "center",
        overflow: "hidden",
        borderRadius: "10px", // 이미지 영역도 모서리 둥글게
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)", // 이미지 쉐도우 추가
        backgroundColor: "#fff", // 배경색 추가
        margin: "5px", // 이미지 간 간격
      }}
    >
      <img
        src={`${API_BASE_URL}${imageData.product_image}`}
        alt="상품 이미지"
        style={{
          maxWidth: "100%",
          maxHeight: "100%", // 박스 내에서 이미지가 꽉 차도록
          objectFit: "contain", // 비율 유지
          borderRadius: "8px", // 이미지 자체에도 둥글게
        }}
      />
    </div>
  )}

  {/* 파렛트랙 이미지 표시 */}
  {checkboxValues.palletRack && imageData.pallet_image && (
    <div
      style={{
        width: checkboxValues.pallet ? "50%" : "100%", // 둘 다 있으면 50%, 하나만 있으면 100%
        height: "100%", // 상하 전체 차지
        display: "flex",
        justifyContent: "center", // 이미지 가운데 정렬
        alignItems: "center",
        overflow: "hidden",
        borderRadius: "10px", // 이미지 영역도 모서리 둥글게
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)", // 이미지 쉐도우 추가
        backgroundColor: "#fff", // 배경색 추가
        margin: "5px", // 이미지 간 간격
      }}
    >
      <img
        src={`${API_BASE_URL}${imageData.pallet_image}`}
        alt="파렛트 이미지"
        style={{
          maxWidth: "100%",
          maxHeight: "100%", // 박스 내에서 이미지가 꽉 차도록
          objectFit: "contain", // 비율 유지
          borderRadius: "8px", // 이미지 자체에도 둥글게
        }}
      />
    </div>
  )}
</div>
<div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
  {/* 제품번호 체크박스 */}
  <label>
    <input
      type="checkbox"
      name="productNumber"
      checked={searchFilters.productNumber}
      onChange={handleSearchFilterChange}
    />
    제품번호
  </label>

  {/* 입고날짜 체크박스 */}
  <label>
    <input
      type="checkbox"
      name="arrivalDate"
      checked={searchFilters.arrivalDate}
      onChange={handleSearchFilterChange}
    />
    입고날짜
  </label>

  {/* 서치바 */}
  <input
    type="text"
    placeholder="Search"
    value={searchText}
    onChange={(e) => setSearchText(e.target.value)}
    style={{ flex: 2, padding: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
  />

  {/* 검색 버튼 */}
  <button
    onClick={handleSearch}
    style={{
      flex: 0.5,
      padding: "5px 10px",
      border: "none",
      borderRadius: "4px",
      backgroundColor: "#6f47c5",
      color: "white",
      cursor: "pointer",
    }}
  >
    검색
  </button>
  {/* N개씩 보기 드롭다운 */}
  <select
          onChange={handleRowsPerPageChange}
          value={rowsPerPage}
          style={{
            flex: 0.5,
            padding: "5px",
            border: "1px solid #ddd",
            borderRadius: "4px",
          }}
        >
          <option value={5}>5개</option>
          <option value={10}>10개</option>
          <option value={20}>20개</option>
          <option value={50}>50개</option>
          <option value={100}>100개</option>
        </select>
</div>


      {/* AG Grid */}
      <div className="ag-theme-alpine" style={{ height: 400, width: "100%", marginBottom: "20px", borderRadius:"20px" }}>
        <AgGridReact
          rowData={tableData}
          columnDefs={[
            { headerName: "상품명", field: "product_name", sortable: true, filter: true },
            { headerName: "제품번호", field: "product_number", sortable: true, filter: true },
            { headerName: "현재재고량", field: "inbound_quantity", sortable: true, filter: true },
            { headerName: "현 위치", field: "warehouse_num", sortable: true, filter: true },
            { headerName: "현 상태", field: "warehouse_type", sortable: true, filter: true },
          ]}
          onRowClicked={handleRowClick}
        />
      </div>
    </div>
    </div>
  );
};

export default InventoryStatus; 