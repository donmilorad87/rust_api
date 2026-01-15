use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn parse_signature_header(header: &str) -> Option<(String, Vec<String>)> {
    let mut timestamp: Option<String> = None;
    let mut signatures = Vec::new();

    for part in header.split(',') {
        let mut iter = part.trim().splitn(2, '=');
        let key = iter.next().unwrap_or_default();
        let value = iter.next().unwrap_or_default();

        match key {
            "t" => timestamp = Some(value.to_string()),
            "v1" => signatures.push(value.to_string()),
            _ => {}
        }
    }

    let timestamp = timestamp?;
    if signatures.is_empty() {
        return None;
    }

    Some((timestamp, signatures))
}

pub fn compute_signature(secret: &str, signed_payload: &str) -> Option<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(signed_payload.as_bytes());
    let result = mac.finalize().into_bytes();
    Some(hex::encode(result))
}

pub fn verify_signature(payload: &[u8], header: &str, secret: &str) -> bool {
    if secret.is_empty() {
        return false;
    }

    let (timestamp, signatures) = match parse_signature_header(header) {
        Some(parsed) => parsed,
        None => return false,
    };

    let signed_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));

    for signature in signatures {
        let signature_bytes = match hex::decode(signature) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };

        let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
            Ok(mac) => mac,
            Err(_) => return false,
        };
        mac.update(signed_payload.as_bytes());

        if mac.verify_slice(&signature_bytes).is_ok() {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::{compute_signature, verify_signature};

    #[test]
    fn verify_signature_accepts_valid_signature() {
        let secret = "whsec_test_secret";
        let payload = br#"{"type":"checkout.session.completed"}"#;
        let timestamp = "1700000000";
        let signed_payload = format!("{}.{}", timestamp, String::from_utf8_lossy(payload));
        let signature = compute_signature(secret, &signed_payload).unwrap();
        let header = format!("t={},v1={}", timestamp, signature);

        assert!(verify_signature(payload, &header, secret));
    }

    #[test]
    fn verify_signature_rejects_invalid_signature() {
        let secret = "whsec_test_secret";
        let payload = br#"{"type":"checkout.session.completed"}"#;
        let header = "t=1700000000,v1=deadbeef";

        assert!(!verify_signature(payload, header, secret));
    }
}
