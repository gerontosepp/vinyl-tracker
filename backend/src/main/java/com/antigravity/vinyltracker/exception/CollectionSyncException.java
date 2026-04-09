package com.antigravity.vinyltracker.exception;

public class CollectionSyncException extends RuntimeException {

    public CollectionSyncException(String message) {
        super(message);
    }

    public CollectionSyncException(String message, Throwable cause) {
        super(message, cause);
    }
}
