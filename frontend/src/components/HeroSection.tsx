import './HeroSection.css';

function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-section__overlay">
        <div className="hero-section__content">
          <p className="hero-section__tag">TIMTRO DA NANG</p>
          <h1 className="hero-section__title">Tìm phòng trọ ưng ý tại Đà Nẵng</h1>

          <form className="hero-search" role="search">
            <div className="hero-search__main">
              <span className="hero-search__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path
                    d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 0 9 9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <input
                type="text"
                className="hero-search__input"
                placeholder="Nhập khu vực, tên đường hoặc loại phòng..."
              />
              <button type="submit" className="hero-search__submit">
                Tìm kiếm
              </button>
            </div>

            <div className="hero-search__filters">
              <select className="hero-search__select" defaultValue="">
                <option value="" disabled>
                  Quận/Huyện
                </option>
                <option value="hai-chau">Hải Châu</option>
                <option value="thanh-khe">Thanh Khê</option>
                <option value="son-tra">Sơn Trà</option>
                <option value="ngu-hanh-son">Ngũ Hành Sơn</option>
                <option value="lien-chieu">Liên Chiểu</option>
                <option value="cam-le">Cẩm Lệ</option>
                <option value="hoa-vang">Hòa Vang</option>
              </select>

              <select className="hero-search__select" defaultValue="">
                <option value="" disabled>
                  Giá
                </option>
                <option value="under-2">Dưới 2 triệu</option>
                <option value="2-4">2 - 4 triệu</option>
                <option value="4-6">4 - 6 triệu</option>
                <option value="over-6">Trên 6 triệu</option>
              </select>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

