export const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        res.status(401).json({ error: "未登录" });
        return;
    }
    next();
};
export const requireAdmin = (req, res, next) => {
    if (req.session.role !== "admin") {
        res.status(403).json({ error: "需要管理员权限" });
        return;
    }
    next();
};
