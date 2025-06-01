import React, { useState, useEffect, useCallback } from "react";
import { axios5010 } from '../api/axios';
import axios from "axios";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const API_BASE_URL = "http://34.64.211.3:5070";
const API_DASHBOARD_BASE_URL = "http://34.64.211.3:5010";

const InventoryStatus = () => {
  const [checkboxValues, setCheckboxValues] = useState({ pallet: true, palletRack: true });
  const [dropdownData, setDropdownData] = useState({ distribution_centers: [], functionalities: [], regions: [] });
  const [selectedDropdown, setSelectedDropdown] = useState({ center: "", functionality: "", region: "" });
  const [searchFilters, setSearchFilters] = useState({ productNumber: false, arrivalDate: false });
  const [imageData, setImageData] = useState({ product_image: null, pallet_image: null });
  const [allItems, setAllItems] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // 테이블 데이터 및 드롭다운 항목 로드
  const fetchDropdownData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios5010.get(`${API_DASHBOARD_BASE_URL}/dashboard/storage-items`);
      const allData = response.data.all_items;
      console.log("📦 전체 데이터:", allData);
      setAllItems(allData);
    } catch (err) {
      console.error("Error fetching storage data:", err);
      setError("입고 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const getFilteredData = useCallback(() => {
    let filtered = [...allItems];
    // 드롭다운 필터
    if (selectedDropdown.center) {
      filtered = filtered.filter(item => item.warehouse_location === selectedDropdown.center);
    }
    if (selectedDropdown.functionality) {
      filtered = filtered.filter(item => item.warehouse_type === selectedDropdown.functionality);
    }
    if (selectedDropdown.region) {
      filtered = filtered.filter(item => item.warehouse_num === selectedDropdown.region);
    }
    // 검색 필터
    if (searchFilters.productNumber && searchText) {
      filtered = filtered.filter(item =>
        item.product_number?.toLowerCase().includes(searchText.toLowerCase())
      );
      console.log("🧪 제품번호 필터 결과:", filtered.length);
    }
    if (searchFilters.arrivalDate && searchText) {
      filtered = filtered.filter(item =>
        item.subscription_inbound_date && item.subscription_inbound_date.toString().includes(searchText)
      );
    }
    return filtered.slice(0, rowsPerPage);
  }, [allItems, selectedDropdown, searchFilters, searchText, rowsPerPage]);

  useEffect(() => {
    const centers = [...new Set(allItems.map(item => item.warehouse_location).filter(Boolean))];
    const types = [...new Set(allItems.map(item => item.warehouse_type).filter(Boolean))];
    const regions = [...new Set(allItems.map(item => item.warehouse_num).filter(Boolean))];
  
    setDropdownData({
      distribution_centers: centers,
      functionalities: types,
      regions: regions
    });
  }, [allItems]);

  useEffect(() => {
    fetchDropdownData(); // 데이터 요청
  }, [fetchDropdownData]);
  
  useEffect(() => {
    // allItems 변경 시 tableData를 기본값으로 설정
    setTableData(allItems);
  }, [allItems]);

  function getCookie(name) {
    const matches = document.cookie.match(new RegExp(
      `(?:^|; )${name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1')}=([^;]*)`
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
  }

  const fetchProductImages = useCallback(async (productId) => {
    try {
      const token = getCookie("accessToken");
      const response = await axios.get(`${API_BASE_URL}/product-images/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        withCredentials: true
      });

      const { product_image, pallet_image } = response.data;
      setImageData({ product_image, pallet_image });
      
    } catch (err) {
      console.error("❌ 이미지 가져오기 실패:", err.message);
      setError("상품 이미지를 불러오는 중 오류가 발생했습니다.");
    }
  }, []);

  const handleDropdownChange = (e, field) => {
    setSelectedDropdown({ ...selectedDropdown, [field]: e.target.value });
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
  };

  const handleCheckboxChange = (e) => {
    setCheckboxValues({ ...checkboxValues, [e.target.name]: e.target.checked });
  };

  const handleSearchFilterChange = (e) => {
    setSearchFilters({ ...searchFilters, [e.target.name]: e.target.checked });
    console.log("🔍 검색 조건 체크:", searchFilters, searchText);
  };

  const handleSearch = () => {
    setTableData(getFilteredData());
  };

  const handleRowClick = (event) => {
    const productId = event.data.id;
    setSelectedProductId(productId);
    fetchProductImages(productId);
  };

  {console.log("📦 product_image:", imageData.product_image)}
  {console.log("📦 pallet_image:", imageData.pallet_image)}


  return (
    <div style={styles.container}>
    <div style={styles.inner}>
      <h3>입고 현황</h3>
      <div style={styles.divider}></div>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* 드롭다운 및 체크박스 */}
      <div style={styles.filterRow}>
        <div style={styles.checkboxGroup}>
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

        <div style={styles.dropdownGroup}>
          <select onChange={(e) => handleDropdownChange(e, "center")} value={selectedDropdown.center}>
            <option value="">물류 센터</option>
            {dropdownData.distribution_centers.map((center, index) => (
              <option key={index} value={center}>{center}</option>
            ))}
          </select>
          <select onChange={(e) => handleDropdownChange(e, "functionality")} value={selectedDropdown.functionality}>
            <option value="">기능별</option>
            {dropdownData.functionalities.map((func, index) => (
              <option key={index} value={func}>{func}</option>
            ))}
          </select>
          <select onChange={(e) => handleDropdownChange(e, "region")} value={selectedDropdown.region}>
            <option value="">구역별</option>
            {dropdownData.regions.map((region, index) => (
              <option key={index} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div style={styles.imageBox}>
        {checkboxValues.pallet && imageData.product_image && (
          <div style={styles.imageContainer(checkboxValues.palletRack)}>
            <img src={`${API_BASE_URL}${imageData.product_image}`} alt="상품 이미지" style={styles.imageStyle} />
          </div>
        )}
        {checkboxValues.palletRack && imageData.pallet_image && (
          <div style={styles.imageContainer(checkboxValues.pallet)}>
            <img src={`${API_BASE_URL}${imageData.pallet_image}`} alt="파렛트 이미지" style={styles.imageStyle} />
          </div>
        )}
      </div>

      {/* 검색 바 및 필터 */}
      <div style={styles.searchControls}>
        <label>
          <input
            type="checkbox"
            name="productNumber"
            checked={searchFilters.productNumber}
            onChange={handleSearchFilterChange}
          />
          제품번호
        </label>
        <label>
          <input
            type="checkbox"
            name="arrivalDate"
            checked={searchFilters.arrivalDate}
            onChange={handleSearchFilterChange}
          />
          입고날짜
        </label>
        <input
          type="text"
          placeholder="Search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={styles.searchInput}
        />
        <button onClick={handleSearch} style={styles.searchButton}>검색</button>
        <select onChange={handleRowsPerPageChange} value={rowsPerPage} style={styles.pageSelect}>
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

const styles = {
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    width: "96%",
    marginTop: "20px",
    padding: "5px",
    marginLeft: "20px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    background: "linear-gradient(135deg, #ffffff, #ffffff)",
  },
  inner: {
    padding: "10px 10px",
  },
  divider: {
    width: "98.5%",
    backgroundColor: "#6f47c5",
    border: "1px solid #6f47c5",
    marginBottom: "10px",
  },
  filterRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "20px",
    marginBottom: "20px",
    padding: "0 10px",
  },
  checkboxGroup: {
    display: "flex",
    gap: "10px",
  },
  dropdownGroup: {
    display: "flex",
    gap: "10px",
  },
  imageBox: {
    display: "flex",
    width: "97.5%",
    height: "50vh",
    border: "1px solid #ddd",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    background: "linear-gradient(135deg, #f9f9f9, #e6e6e6)",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: "20px",
    padding: "10px",
  },
  imageContainer: (isHalf) => ({
    width: isHalf ? "50%" : "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: "10px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    backgroundColor: "#fff",
    margin: "5px",
  }),
  imageStyle: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: "8px",
  },
  searchControls: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
  },
  searchInput: {
    flex: 2,
    padding: "5px",
    borderRadius: "4px",
    border: "1px solid #ddd",
  },
  searchButton: {
    flex: 0.5,
    padding: "5px 10px",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "#6f47c5",
    color: "white",
    cursor: "pointer",
  },
  pageSelect: {
    flex: 0.5,
    padding: "5px",
    border: "1px solid #ddd",
    borderRadius: "4px",
  },
  gridContainer: {
    height: 400,
    width: "100%",
    marginBottom: "20px",
    borderRadius: "20px",
  },
};