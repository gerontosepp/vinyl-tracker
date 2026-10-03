package com.antigravity.vinyltracker.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problemDetail.setTitle("Validation failed");
        problemDetail.setDetail("Request validation failed.");

        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                fieldErrors.put(error.getField(), error.getDefaultMessage()));

        problemDetail.setProperty("errors", fieldErrors);
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.badRequest().body(problemDetail);
    }

    @ExceptionHandler({
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
            BindException.class,
            IllegalArgumentException.class
    })
    public ResponseEntity<ProblemDetail> handleBadRequest(Exception ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problemDetail.setTitle("Bad request");
        problemDetail.setDetail(ex.getMessage() != null ? ex.getMessage() : "Request could not be parsed.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.badRequest().body(problemDetail);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(ResourceNotFoundException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problemDetail.setTitle("Resource not found");
        problemDetail.setDetail(ex.getMessage() != null ? ex.getMessage() : "The requested resource was not found.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problemDetail);
    }

    @ExceptionHandler(DiscogsTokenException.class)
    public ResponseEntity<ProblemDetail> handleDiscogsToken(DiscogsTokenException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(422);
        problemDetail.setTitle("Discogs token error");
        problemDetail.setDetail(ex.getMessage() != null ? ex.getMessage() : "Invalid or missing Discogs token.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.status(422).body(problemDetail);
    }

    @ExceptionHandler(DiscogsApiException.class)
    public ResponseEntity<ProblemDetail> handleDiscogsApi(DiscogsApiException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.BAD_GATEWAY);
        problemDetail.setTitle("Discogs API error");
        problemDetail.setDetail(ex.getMessage() != null ? ex.getMessage() : "Error communicating with Discogs API.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(problemDetail);
    }

    @ExceptionHandler(CollectionSyncException.class)
    public ResponseEntity<ProblemDetail> handleCollectionSync(CollectionSyncException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problemDetail.setTitle("Collection sync error");
        problemDetail.setDetail(ex.getMessage() != null ? ex.getMessage() : "Error syncing collection.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problemDetail);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ProblemDetail> handleRuntime(RuntimeException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problemDetail.setTitle("Internal server error");
        problemDetail.setDetail(ex.getMessage() != null ? ex.getMessage() : "Unexpected runtime error.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problemDetail);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneric(Exception ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problemDetail.setTitle("Internal server error");
        problemDetail.setDetail("An unexpected error occurred.");
        problemDetail.setProperty("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problemDetail);
    }
}