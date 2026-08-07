-- Catalog DB: للقراءة فقط، Read Replication
-- لا يحتوي تقدم/اجهزة/مفضلة - تلك في Family DO
CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, title TEXT, description TEXT, planet_id TEXT);
CREATE TABLE IF NOT EXISTS episodes (id TEXT PRIMARY KEY, series_id TEXT, title TEXT);
