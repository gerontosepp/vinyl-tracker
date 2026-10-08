package com.antigravity.vinyltracker.service.roon;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MooMessageTest {

    @Test
    void shouldParseMooRequestMessage() {
        String raw = "MOO/1 REQUEST com.roonlabs.ping:1/ping\n" +
                "Request-Id: 42\n" +
                "Content-Length: 0\n" +
                "\n";

        MooMessage msg = MooMessage.parse(raw);

        assertThat(msg).isNotNull();
        assertThat(msg.getVerb()).isEqualTo("REQUEST");
        assertThat(msg.getNameOrStatus()).isEqualTo("com.roonlabs.ping:1/ping");
        assertThat(msg.getRequestId()).isEqualTo("42");
        assertThat(msg.getContentLength()).isEqualTo(0);
        assertThat(msg.getBody()).isEmpty();
    }

    @Test
    void shouldParseMooResponseMessageWithBody() {
        String body = "{\"core_id\":\"1234-abcd\",\"display_name\":\"Living Room Core\"}";
        String raw = "MOO/1 COMPLETE Success\r\n" +
                "Request-Id: 1\r\n" +
                "Content-Type: application/json\r\n" +
                "Content-Length: " + body.length() + "\r\n" +
                "\r\n" +
                body;

        MooMessage msg = MooMessage.parse(raw);

        assertThat(msg).isNotNull();
        assertThat(msg.getVerb()).isEqualTo("COMPLETE");
        assertThat(msg.getNameOrStatus()).isEqualTo("Success");
        assertThat(msg.getRequestId()).isEqualTo("1");
        assertThat(msg.getHeader("Content-Type")).isEqualTo("application/json");
        assertThat(msg.getBody()).isEqualTo(body);
    }

    @Test
    void shouldSerializeMooMessageToWireString() {
        MooMessage msg = MooMessage.builder()
                .verb("REQUEST")
                .nameOrStatus("com.roonlabs.registry:1/info")
                .build();
        msg.setHeader("Request-Id", "9");

        String wire = msg.toWireString();

        assertThat(wire).startsWith("MOO/1 REQUEST com.roonlabs.registry:1/info\n");
        assertThat(wire).contains("Request-Id: 9\n");
        assertThat(wire).contains("Content-Length: 0\n");
        assertThat(wire).endsWith("\n\n");
    }

    @Test
    void shouldReturnNullForInvalidMessage() {
        assertThat(MooMessage.parse(null)).isNull();
        assertThat(MooMessage.parse("")).isNull();
        assertThat(MooMessage.parse("NOT_A_MOO_MESSAGE\n\n")).isNull();
    }
}
