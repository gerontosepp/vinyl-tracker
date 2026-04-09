package com.antigravity.vinyltracker.exception;

public class DiscogsApiException extends RuntimeException {

    public DiscogsApiException(String message) {
        super(message);
    }

    public DiscogsApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
