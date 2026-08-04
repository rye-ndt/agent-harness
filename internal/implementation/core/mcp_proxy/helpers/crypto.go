package mcp_proxy_helpers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"

	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
)

func NewCipher(encodeKey string) (cipher.AEAD, error) {
	key := sha256.Sum256([]byte(encodeKey))

	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}

	return cipher.NewGCM(block)
}

func Encrypt(aead cipher.AEAD, plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", custom_error.TypedCritical(enums.ErrMcpStoreCredentials, "cannot generate nonce: %v", err)
	}

	sealed := aead.Seal(nonce, nonce, []byte(plaintext), nil)

	return base64.StdEncoding.EncodeToString(sealed), nil
}

func Decrypt(aead cipher.AEAD, encoded string) (string, error) {
	if encoded == "" {
		return "", nil
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", custom_error.TypedCritical(enums.ErrMcpStoreCredentials, "cannot decode credential: %v", err)
	}

	nonceSize := aead.NonceSize()
	if len(raw) < nonceSize {
		return "", custom_error.TypedCritical(enums.ErrMcpStoreCredentials, "credential is truncated")
	}

	plaintext, err := aead.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
	if err != nil {
		return "", custom_error.TypedCritical(enums.ErrMcpStoreCredentials, "cannot decrypt credential: %v", err)
	}

	return string(plaintext), nil
}
