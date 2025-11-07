/**
 * Air Quality Service - Tính toán chất lượng không khí
 * Dựa trên WHO Air Quality Guidelines 2021 & EPA standards
 * Tính toán AQI từ dữ liệu PM2.5 và PM10
 */

class AirQualityService {
  constructor() {
    console.log("AirQualityService: Initialized");
  }

  /**
   * Calculate Air Quality Index based on PM2.5 and PM10 values
   * @param {Object} data - Object containing pm25 and pm10 values
   * @param {number|null} data.pm25 - PM2.5 value in μg/m³
   * @param {number|null} data.pm10 - PM10 value in μg/m³
   * @returns {Object} Air quality result with status, color, label, and level
   */
  calculateAirQuality(data) {
    if (!data || (data.pm25 === null && data.pm10 === null)) {
      return {
        status: "KHÔNG XÁC ĐỊNH",
        color: "#757575",
        label: "Không có dữ liệu",
        level: 0,
        primary: null,
      };
    }

    let pm25Level = 0;
    let pm10Level = 0;
    let pm25Category = null;
    let pm10Category = null;

    // Calculate PM2.5 level based on WHO Air Quality Guidelines 2021 & EPA standards
    if (data.pm25 !== null && data.pm25 >= 0) {
      if (data.pm25 <= 15) {
        pm25Level = 1; // Good
        pm25Category = "TỐT";
      } else if (data.pm25 <= 25) {
        pm25Level = 2; // Moderate
        pm25Category = "KHẤP";
      } else if (data.pm25 <= 35) {
        pm25Level = 3; // Unhealthy for Sensitive Groups
        pm25Category = "TB";
      } else if (data.pm25 <= 55) {
        pm25Level = 4; // Unhealthy
        pm25Category = "KÉM";
      } else {
        pm25Level = 5; // Very Unhealthy
        pm25Category = "XẤU";
      }
    }

    // Calculate PM10 level based on WHO Air Quality Guidelines 2021 & EPA standards
    if (data.pm10 !== null && data.pm10 >= 0) {
      if (data.pm10 <= 45) {
        pm10Level = 1; // Good
        pm10Category = "TỐT";
      } else if (data.pm10 <= 55) {
        pm10Level = 2; // Moderate
        pm10Category = "KHẤP";
      } else if (data.pm10 <= 75) {
        pm10Level = 3; // Unhealthy for Sensitive Groups
        pm10Category = "TB";
      } else if (data.pm10 <= 100) {
        pm10Level = 4; // Unhealthy
        pm10Category = "KÉM";
      } else {
        pm10Level = 5; // Very Unhealthy
        pm10Category = "XẤU";
      }
    }

    // Take the worse of the two levels
    const worstLevel = Math.max(pm25Level, pm10Level);
    const primaryPollutant = pm25Level >= pm10Level ? "PM2.5" : "PM10";

    // Map level to status and colors
    switch (worstLevel) {
      case 1:
        return {
          status: "TỐT",
          color: "#4CAF50",
          label: "Chất lượng không khí tốt",
          level: 1,
          primary: primaryPollutant,
          pm25Category,
          pm10Category,
        };
      case 2:
        return {
          status: "KHẤP",
          color: "#FFEB3B",
          label: "Chấp nhận được, nhóm nhạy cảm nên hạn chế",
          level: 2,
          primary: primaryPollutant,
          pm25Category,
          pm10Category,
        };
      case 3:
        return {
          status: "TB",
          color: "#FF9800",
          label: "Không tốt cho nhóm nhạy cảm",
          level: 3,
          primary: primaryPollutant,
          pm25Category,
          pm10Category,
        };
      case 4:
        return {
          status: "KÉM",
          color: "#F44336",
          label: "Có thể gây hại cho sức khỏe",
          level: 4,
          primary: primaryPollutant,
          pm25Category,
          pm10Category,
        };
      case 5:
        return {
          status: "XẤU",
          color: "#9C27B0",
          label: "Nguy hiểm cho sức khỏe",
          level: 5,
          primary: primaryPollutant,
          pm25Category,
          pm10Category,
        };
      default:
        return {
          status: "TỐT",
          color: "#4CAF50",
          label: "Chất lượng không khí tốt",
          level: 1,
          primary: null,
          pm25Category,
          pm10Category,
        };
    }
  }

  /**
   * Get air quality text description based on level
   * @param {number} level - Air quality level (1-5)
   * @returns {string} Detailed description
   */
  getAirQualityDescription(level) {
    switch (level) {
      case 1:
        return "Chất lượng không khí tốt. An toàn cho mọi hoạt động ngoài trời.";
      case 2:
        return "Chất lượng không khí chấp nhận được. Nhóm nhạy cảm nên hạn chế hoạt động ngoài trời kéo dài.";
      case 3:
        return "Không tốt cho nhóm nhạy cảm. Trẻ em, người già và người bệnh nên hạn chế ra ngoài.";
      case 4:
        return "Có thể gây hại cho sức khỏe. Mọi người nên hạn chế hoạt động ngoài trời.";
      case 5:
        return "Nguy hiểm cho sức khỏe. Tránh hoạt động ngoài trời, đóng cửa sổ.";
      default:
        return "Không có dữ liệu đủ để đánh giá.";
    }
  }

  /**
   * Get health recommendations based on air quality level
   * @param {number} level - Air quality level (1-5)
   * @returns {Array} Array of recommendation strings
   */
  getHealthRecommendations(level) {
    switch (level) {
      case 1:
        return [
          "Hoạt động ngoài trời bình thường",
          "Tất cả mọi người đều an toàn",
        ];
      case 2:
        return [
          "Hoạt động ngoài trời bình thường cho hầu hết mọi người",
          "Nhóm nhạy cảm nên hạn chế thời gian ở ngoài kéo dài",
        ];
      case 3:
        return [
          "Hạn chế hoạt động ngoài trời cho trẻ em và người già",
          "Giảm cường độ tập thể dục ngoài trời",
        ];
      case 4:
        return [
          "Tránh hoạt động ngoài trời kéo dài",
          "Đeo khẩu trang khi ra ngoài",
          "Đóng cửa sổ, sử dụng máy lọc không khí",
        ];
      case 5:
        return [
          "Tránh hoạt động ngoài trời",
          "Ở trong nhà, đóng kín cửa sổ",
          "Sử dụng máy lọc không khí",
          "Đeo khẩu trang N95 nếu bắt buộc ra ngoài",
        ];
      default:
        return ["Không có khuyến cáo cụ thể"];
    }
  }

  /**
   * Check if air quality data is considered "good" or acceptable
   * @param {Object} airQualityResult - Result from calculateAirQuality
   * @returns {boolean} True if air quality is good (level 1-2)
   */
  isAirQualityGood(airQualityResult) {
    return airQualityResult && airQualityResult.level <= 2;
  }

  /**
   * Check if air quality data is considered unhealthy
   * @param {Object} airQualityResult - Result from calculateAirQuality
   * @returns {boolean} True if air quality is unhealthy (level 4-5)
   */
  isAirQualityUnhealthy(airQualityResult) {
    return airQualityResult && airQualityResult.level >= 4;
  }
}

// Make available in global scope
if (typeof module !== "undefined" && module.exports) {
  module.exports = AirQualityService;
} else if (typeof window !== "undefined") {
  window.AirQualityService = AirQualityService;
}
