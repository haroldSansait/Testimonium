import { getFirebaseAuth } from "../config/firebase.js";

export class FirebaseAdminService {
  /**
   * Registers a user in Firebase Auth.
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.displayName
   * @param {string} [params.password] - Optional temporary password
   * @returns {Promise<object>} Firebase UserRecord object
   */
  async createUser({ email, displayName, password }) {
    try {
      const payload = {
        email,
        displayName,
        emailVerified: true,
        disabled: false,
      };
      if (password) {
        payload.password = password;
      }
      return await getFirebaseAuth().createUser(payload);
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        const customError = new Error("This email is already registered in Firebase Authentication.");
        customError.statusCode = 409;
        throw customError;
      }
      throw error;
    }
  }

  /**
   * Updates an existing user record in Firebase Auth.
   * @param {string} uid
   * @param {object} params
   * @param {string} [params.email]
   * @param {string} [params.displayName]
   * @param {boolean} [params.disabled]
   * @returns {Promise<object>} Updated UserRecord object
   */
  async updateUser(uid, { email, displayName, disabled }) {
    const updatePayload = {};
    if (email !== undefined) updatePayload.email = email;
    if (displayName !== undefined) updatePayload.displayName = displayName;
    if (disabled !== undefined) updatePayload.disabled = disabled;

    return getFirebaseAuth().updateUser(uid, updatePayload);
  }

  /**
   * Deletes a user record from Firebase Auth.
   * Used primarily for transactional rollback.
   * @param {string} uid
   * @returns {Promise<void>}
   */
  async deleteUser(uid) {
    await getFirebaseAuth().deleteUser(uid);
  }

  /**
   * Generates a password reset link.
   * @param {string} email
   * @returns {Promise<string>} Reset link URL
   */
  async generatePasswordResetLink(email) {
    return getFirebaseAuth().generatePasswordResetLink(email);
  }

  /**
   * Lists batches of users in Firebase Auth.
   * @param {number} [maxResults=1000]
   * @param {string} [nextPageToken]
   * @returns {Promise<object>} ListUsersResult object
   */
  async listUsers(maxResults = 1000, nextPageToken) {
    return getFirebaseAuth().listUsers(maxResults, nextPageToken);
  }

  /**
   * Fetches a Firebase user by UID.
   * @param {string} uid
   * @returns {Promise<object>} Firebase UserRecord
   */
  async getUser(uid) {
    return getFirebaseAuth().getUser(uid);
  }

  /**
   * Fetches a Firebase user by Email.
   * Returns null if user is not found.
   * @param {string} email
   * @returns {Promise<object|null>} Firebase UserRecord or null
   */
  async getUserByEmail(email) {
    try {
      return await getFirebaseAuth().getUserByEmail(email);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Marks a user's email as verified in Firebase Auth.
   * @param {string} uid
   * @param {boolean} [emailVerified=true]
   * @returns {Promise<object>} Updated UserRecord
   */
  async setEmailVerified(uid, emailVerified = true, email) {
    return getFirebaseAuth().updateUser(uid, { emailVerified, ...(email ? { email } : {}) });
  }

  /**
   * Updates a user's password in Firebase Auth.
   * @param {string} uid
   * @param {string} newPassword
   * @returns {Promise<object>} Updated UserRecord
   */
  async updatePassword(uid, newPassword) {
    return getFirebaseAuth().updateUser(uid, { password: newPassword });
  }

  /**
   * Revokes all refresh tokens and active sessions for a user.
   * @param {string} uid
   * @returns {Promise<void>}
   */
  async revokeRefreshTokens(uid) {
    return getFirebaseAuth().revokeRefreshTokens(uid);
  }
}
