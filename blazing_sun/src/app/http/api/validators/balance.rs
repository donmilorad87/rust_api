use serde::Deserialize;
use validator::Validate;

#[derive(Deserialize, Debug)]
pub struct BalanceCheckoutRequestRaw {
    pub amount: Option<i64>,
}

#[derive(Debug, Validate)]
pub struct BalanceCheckoutRequest {
    #[validate(range(min = 1, message = "must be at least 1"))]
    pub amount: i64,
}
