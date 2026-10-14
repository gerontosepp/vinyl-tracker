use std::{net::SocketAddr, time::Duration};
use tokio::net::UdpSocket;

pub struct RoonDiscovery;

impl RoonDiscovery {
    pub async fn discover_core(timeout: Duration) -> Option<(String, u16)> {
        let socket = match UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                tracing::debug!("Failed to bind UDP socket for Roon discovery: {e}");
                return None;
            }
        };

        if let Err(e) = socket.set_broadcast(true) {
            tracing::debug!("Failed to set UDP broadcast: {e}");
            return None;
        }

        let query = b"SOOD-2\r\nquery\r\nservice_id: com.roonlabs.registry:1\r\n\r\n";
        let target: SocketAddr = "255.255.255.255:9003".parse().ok()?;

        if let Err(e) = socket.send_to(query, target).await {
            tracing::debug!("Failed to send SOOD discovery broadcast: {e}");
            return None;
        }

        let mut buf = [0u8; 1024];
        let recv_fut = socket.recv_from(&mut buf);

        match tokio::time::timeout(timeout, recv_fut).await {
            Ok(Ok((len, peer))) => {
                let text = String::from_utf8_lossy(&buf[..len]);
                if text.starts_with("SOOD-2") {
                    let mut port = 9330u16;
                    for line in text.lines() {
                        if let Some(p) = line
                            .strip_prefix("http_port:")
                            .and_then(|r| r.trim().parse::<u16>().ok())
                        {
                            port = p;
                        }
                    }
                    Some((peer.ip().to_string(), port))
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}
