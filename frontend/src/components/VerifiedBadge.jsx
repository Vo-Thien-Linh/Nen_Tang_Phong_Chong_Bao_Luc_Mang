import React from 'react';

/**
 * VerifiedBadge - Huy hiệu tích xanh chính thức chuẩn mạng xã hội
 * Cục tích xanh dương hoàng gia với dấu tích màu trắng tinh ở giữa
 */
export default function VerifiedBadge({ size = 'sm', className = '', title = 'Đã xác minh' }) {
  const sizeMap = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  };

  const dimension = sizeMap[size] || sizeMap.sm;

  return (
    <svg 
      viewBox="0 0 24 24" 
      aria-label={title}
      title={title}
      className={`inline-block shrink-0 align-middle ${dimension} ${className}`}
      fill="none"
    >
      {/* Khối huy hiệu xanh dương lượn sóng chuẩn WINGS / Meta / X */}
      <path 
        d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.575 10.45.7 11.82.7 13.4c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238 1.05 1.273 2.42 2.148 4 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-1.05 2.148-2.42 2.148-4z" 
        fill="#2563EB"
      />
      {/* Dấu tích trắng sắc nét ở giữa */}
      <path 
        d="M10.2 16.2l-3.6-3.6 1.4-1.4 2.2 2.2 6.2-6.2 1.4 1.4-7.6 7.6z" 
        fill="#FFFFFF"
      />
    </svg>
  );
}
