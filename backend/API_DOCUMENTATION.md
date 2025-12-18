# Backend API Documentation

Base URL: `http://localhost:8080` (or `http://backend:8080` in Docker)

## 1. Health Check
*   **files**: `src/index.ts`
*   **Method**: `GET`
*   **Path**: `/`
*   **Description**: Checks if the backend server is running.
*   **Response**:
    *   `200 OK`: "Backend is running!"

## 2. Get Upload URL
*   **files**: `src/index.ts`
*   **Method**: `POST`
*   **Path**: `/upload-url`
*   **Description**: Generates a signed URL for uploading files to Google Cloud Storage.
*   **Request Body** (JSON):
    ```json
    {
      "filename": "example.pdf",
      "contentType": "application/pdf"
    }
    ```
*   **Response**:
    *   `200 OK`:
        ```json
        {
          "url": "https://storage.googleapis.com/...",
          "filename": "example.pdf"
        }
        ```
    *   `500 Internal Server Error`: `{ "error": "Failed to generate URL" }`

## 3. Process File (Pub/Sub Webhook)
*   **files**: `src/index.ts`
*   **Method**: `POST`
*   **Path**: `/pubsub-webhook`
*   **Description**: Webhook triggered by Pub/Sub (or manually) to process an uploaded file. Downloads the file, parses it (PDF/Docx/Txt), chunks it, embeds it, and stores vectors in the database.
*   **Request Body** (JSON - Pub/Sub format):
    ```json
    {
      "message": {
        "data": "base64_encoded_json_string"
      }
    }
    ```
    *   **Decoded Data Structure**:
        ```json
        {
          "bucket": "bucket-name",
          "name": "filename.pdf",
          "strategy": "recursive", // Optional: "recursive" (default) or others
          "chunkSize": 1000,       // Optional: default 1000
          "chunkOverlap": 200      // Optional: default 200
        }
        ```
*   **Response**:
    *   `200 OK`: "OK" or "No text content"
    *   `400 Bad Request`: If message is missing.
    *   `500 Internal Server Error`: "Internal Error"

## 4. Chat with Docs
*   **files**: `src/index.ts`
*   **Method**: `POST`
*   **Path**: `/chat`
*   **Description**: Chat with the processed documents using RAG (Retrieval Augmented Generation).
*   **Response Type**: `text/event-stream` (Streaming)
*   **Request Body** (JSON):
    ```json
    {
      "query": "What does the document say about X?",
      "systemInstruction": "You are a helpful assistant." // Optional
    }
    ```
*   **Response**:
    *   Streams text chunks of the AI's response.
    *   `500 Internal Server Error`: `{ "error": "Failed to generate answer" }` (if error occurs before streaming starts)

## Error Handling
General error response format:
```json
{
  "error": "Error message description"
}
```
