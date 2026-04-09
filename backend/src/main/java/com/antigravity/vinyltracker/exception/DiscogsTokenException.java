package com.antigravity.vinyltracker.exception;

public class DiscogsTokenException extends RuntimeException {

    public DiscogsTokenException(String message) {
        super(message);
    }

    public DiscogsTokenException(String message, Throwable cause) {
        super(message, cause);
    }
}
