package services

import "testing"

func TestHashPassword(t *testing.T) {
	hash, err := HashPassword("testpassword")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "testpassword" {
		t.Error("hash should not equal plaintext")
	}
}

func TestCheckPassword(t *testing.T) {
	hash, _ := HashPassword("testpassword")
	if !CheckPassword("testpassword", hash) {
		t.Error("correct password should pass check")
	}
	if CheckPassword("wrongpassword", hash) {
		t.Error("wrong password should fail check")
	}
}

func TestGenerateAndParseToken(t *testing.T) {
	secret := "test-secret"
	token, err := GenerateToken(1, "admin", secret)
	if err != nil {
		t.Fatal(err)
	}

	userID, role, err := ParseToken(token, secret)
	if err != nil {
		t.Fatal(err)
	}
	if userID != 1 {
		t.Errorf("expected userID 1, got %d", userID)
	}
	if role != "admin" {
		t.Errorf("expected role admin, got %s", role)
	}
}

func TestParseTokenInvalid(t *testing.T) {
	_, _, err := ParseToken("invalid-token", "test-secret")
	if err == nil {
		t.Error("expected error for invalid token")
	}
}
