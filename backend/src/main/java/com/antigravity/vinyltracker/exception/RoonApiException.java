package com.antigravity.vinyltracker.exception;

public class RoonApiException extends RuntimeException {

    public RoonApiException(String message) {
        super(message);
    }

    public RoonApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
