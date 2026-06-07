# Grab Gia Sư Backend (Spring Boot)

## 1) Cấu trúc thư mục chuẩn MVC

```text
src/main/java/com/grabgiasu/backend
├── controller  # Nhận request/response HTTP (REST API)
├── service     # Xử lý nghiệp vụ hệ thống
├── repository  # Tầng truy cập dữ liệu (JPA Repository)
├── model       # Entity/domain model ánh xạ DB
├── dto         # Request/Response object trao đổi dữ liệu API
├── config      # Cấu hình bean ứng dụng (AuthenticationManager, PasswordEncoder...)
├── security    # JWT, filter, cấu hình Spring Security
├── exception   # Xử lý lỗi tập trung (global exception handler)
└── util        # Các lớp tiện ích dùng chung (wrapper response...)
```

## 2) Vai trò các dependency trong `pom.xml`

- `spring-boot-starter-web`: xây dựng REST API.
- `spring-boot-starter-data-jpa`: ORM và truy cập dữ liệu với JPA/Hibernate.
- `spring-boot-starter-security`: xác thực, phân quyền, filter chain.
- `spring-boot-starter-validation`: kiểm tra dữ liệu đầu vào với Jakarta Validation.
- `mssql-jdbc`: driver kết nối SQL Server.
- `jjwt-api`, `jjwt-impl`, `jjwt-jackson`: tạo/kiểm tra JWT token.
- `lombok`: giảm code lặp getter/setter/builder/constructor.
- `spring-boot-starter-test`, `spring-security-test`: test ứng dụng và security.

## 3) Cấu hình chính

- Java 21
- Maven
- Spring Boot 3
- SQL Server trong `application.properties`
- JWT secret + expiration trong `application.properties`

## 4) Chạy ứng dụng

```bash
mvn spring-boot:run
```

Các endpoint mẫu:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
