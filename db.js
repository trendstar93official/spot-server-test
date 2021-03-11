const mysql = require('mysql')
const pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME
});

/*
  CREATE TABLE `sessions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `userId` VARCHAR(100) NOT NULL,
  `access_token` VARCHAR(255) NULL,
  `expires` BIGINT NULL,
  `refresh_token` VARCHAR(255) NULL,
  PRIMARY KEY (`id`, `session_id`),
  UNIQUE INDEX `session_id_UNIQUE` (`session_id` ASC) VISIBLE);
 */

/**
 * @typedef Session
 * @property email {string} The user email
 * @property userId {string} The Spotify user ID
 * @property access_token {string} The access token
 * @property expires {number} The expiration time in seconds
 * @property refresh_token {string} The refresh token
 */


/**
 * Stores the session inside the database
 *
 * @param session_id {string} The session ID from the cookie
 * @param email {string} The user email
 * @param userId {string} The Spotify user ID
 * @param access_token {string} The access token
 * @param expires_in {number} The remaining time before expiration in seconds
 * @param refresh_token {string} The refresh token
 * @return {Promise<void>}
 */
async function storeSession(session_id, email, userId, access_token, expires_in, refresh_token) {
	const expires = new Date().getTime() / 1000 + expires_in

	return new Promise((resolve, reject) => {
		pool.query('REPLACE INTO sessions SET session_id=?, email=?, userId=?, access_token=?, expires=?, refresh_token=?', [session_id, email, id, access_token, expires, refresh_token], function (error) {
			if (error) reject(error)
			else resolve()
		});
	})
}

/**
 * Gets the session from the database
 * @param session_id {string} The session ID from the cookie
 * @return {Promise<Session>}
 */
async function getSession(session_id) {
	return new Promise((resolve, reject) => {
		pool.query('SELECT * FROM sessions WHERE session_id=?', [session_id], function (error, results) {
			if (error) {
				reject(error)
				return
			}

			if (results.length === 0) resolve(null)
			else resolve(results[0])
		});
	})
}


exports.storeSession = 'storeSession'
exports.getSession = 'getSession'

