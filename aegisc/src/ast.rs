#[derive(Debug, Clone)]
pub struct Program { pub items: Vec<Item> }

#[derive(Debug, Clone)]
pub enum Item { Intent(IntentDecl), Policy(PolicyDecl), Adapter(AdapterDecl) }

#[derive(Debug, Clone)]
pub struct IntentDecl { pub name: String, pub fields: Vec<Field> }

#[derive(Debug, Clone)]
pub struct Field { pub name: String, pub ty: String }

#[derive(Debug, Clone)]
pub struct PolicyDecl { pub name: String, pub target_intent: String, pub body: Vec<Stmt> }

#[derive(Debug, Clone)]
pub struct AdapterDecl {
    pub name: String,
    pub target_intent: String,
    pub timeout_ms: u64,
    pub max_retries: u32,
    pub lease_name: String,
    pub body: Vec<Stmt>,
}

#[derive(Debug, Clone)]
pub enum Stmt {
    Commit(String),
    Abort(String),
    Use(String),
    If {
        condition: String,
        then_body: Vec<Stmt>,
        else_body: Vec<Stmt>,
    },
}
