function SearchBar({
  keyword,
  onKeywordChange,
  priceFilter,
  onPriceFilterChange,
}) {
  return (
    <div style={styles.wrapper}>
      <input
        type="text"
        placeholder="Tìm theo tiêu đề, địa chỉ..."
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        style={styles.input}
      />

      <select
        value={priceFilter}
        onChange={(e) => onPriceFilterChange(e.target.value)}
        style={styles.select}
      >
        <option value="all">Tất cả mức giá</option>
        <option value="under2m">Dưới 2 triệu</option>
        <option value="2to3m">Từ 2 - 3 triệu</option>
        <option value="over3m">Trên 3 triệu</option>
      </select>
    </div>
  )
}

const styles = {
  wrapper: {
    background: "#fff",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
    display: "grid",
    gridTemplateColumns: "2fr 220px",
    gap: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  input: {
    height: "44px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    padding: "0 14px",
    fontSize: "15px",
    outline: "none",
  },
  select: {
    height: "44px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: "15px",
    background: "#fff",
  },
}

export default SearchBar