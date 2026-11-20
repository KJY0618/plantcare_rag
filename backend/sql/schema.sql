-- 테이블 4개: plant_species, species_tags, plants, care_logs (A)

-- 1. 식물 도감
CREATE TABLE IF NOT EXISTS plant_species (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cntnts_no VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255),
    english_name VARCHAR(255),
    distribution_name VARCHAR(255),
    family_name VARCHAR(255),
    origin VARCHAR(255),
    growth_height VARCHAR(100),
    growth_width VARCHAR(100),
    leaf_form VARCHAR(255),
    propagation_period VARCHAR(255),
    fertilizer_info VARCHAR(500),
    soil_info VARCHAR(500),
    water_spring VARCHAR(255),
    water_summer VARCHAR(255),
    water_autumn VARCHAR(255),
    water_winter VARCHAR(255),
    winter_min_temp VARCHAR(100),
    manage_level VARCHAR(100),
    manage_demand VARCHAR(100),
    growth_temp VARCHAR(100),
    humidity VARCHAR(100),
    function_info TEXT,
    thumb_url VARCHAR(1000),
    image_url VARCHAR(1000),
    source VARCHAR(100),
    fetched_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 식물 태그
CREATE TABLE IF NOT EXISTS species_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    species_id BIGINT NOT NULL,
    tag_type ENUM('light', 'placement') NOT NULL,
    value VARCHAR(255) NOT NULL,

    UNIQUE (species_id, tag_type, value),

    CONSTRAINT fk_species_tags_species
        FOREIGN KEY (species_id)
        REFERENCES plant_species(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 사용자 식물
CREATE TABLE IF NOT EXISTS plants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    species_id BIGINT NULL,
    custom_species_name VARCHAR(255) NULL,
    nickname VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    purchase_date DATE,
    water_interval_days INT NOT NULL,
    photo_path VARCHAR(1000),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_water_interval
        CHECK (water_interval_days >= 1),

    CONSTRAINT fk_plants_species
        FOREIGN KEY (species_id)
        REFERENCES plant_species(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 케어 기록
CREATE TABLE IF NOT EXISTS care_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plant_id BIGINT NOT NULL,
    log_type ENUM('water', 'fertilizer', 'repot', 'issue') NOT NULL,
    logged_at DATE NOT NULL,
    memo TEXT,
    photo_path VARCHAR(1000),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_care_logs_plant
        FOREIGN KEY (plant_id)
        REFERENCES plants(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_issue_content
        CHECK (
            log_type != 'issue'
            OR (
                (memo IS NOT NULL AND TRIM(memo) != '')
                OR
                (photo_path IS NOT NULL AND TRIM(photo_path) != '')
            )
        )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
