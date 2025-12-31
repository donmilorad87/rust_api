-- Page SEO Metadata Table
-- Stores SEO configuration for each web page
-- One row per page, identified by route_name

CREATE TABLE IF NOT EXISTS page_seo (
    id BIGSERIAL PRIMARY KEY,

    -- Page identification
    route_name VARCHAR(100) NOT NULL UNIQUE,     -- e.g., 'web.home', 'web.sign_in'
    page_path VARCHAR(255) NOT NULL,             -- e.g., '/', '/sign-in'
    page_label VARCHAR(100) NOT NULL,            -- Human-readable: 'Homepage', 'Sign In'

    -- Basic SEO
    title VARCHAR(70),                           -- <title> tag (60-70 chars optimal)
    description VARCHAR(160),                    -- <meta name="description"> (150-160 chars optimal)
    keywords VARCHAR(255),                       -- <meta name="keywords"> (comma-separated)

    -- Open Graph (Facebook, LinkedIn, etc.)
    og_title VARCHAR(95),                        -- og:title (keep under 95 chars)
    og_description VARCHAR(200),                 -- og:description (200 chars max)
    og_image_uuid UUID REFERENCES uploads(uuid) ON DELETE SET NULL,  -- og:image
    og_type VARCHAR(50) DEFAULT 'website',       -- og:type (website, article, product, etc.)

    -- Twitter Card
    twitter_card VARCHAR(50) DEFAULT 'summary',  -- summary, summary_large_image, app, player
    twitter_title VARCHAR(70),                   -- twitter:title
    twitter_description VARCHAR(200),            -- twitter:description
    twitter_image_uuid UUID REFERENCES uploads(uuid) ON DELETE SET NULL,  -- twitter:image

    -- Advanced SEO
    canonical_url VARCHAR(500),                  -- <link rel="canonical"> (optional override)
    robots VARCHAR(100) DEFAULT 'index, follow', -- <meta name="robots"> (index/noindex, follow/nofollow)

    -- Structured Data (JSON-LD)
    structured_data JSONB,                       -- Optional JSON-LD schema.org data

    -- Additional meta tags (flexible)
    custom_meta JSONB DEFAULT '[]',              -- Array of {name, content} for extra meta tags

    -- Status
    is_active BOOLEAN DEFAULT true,              -- Enable/disable SEO for this page

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups by route name
CREATE INDEX idx_page_seo_route_name ON page_seo(route_name);

-- Insert default SEO entries for all web pages
INSERT INTO page_seo (route_name, page_path, page_label, title, description, robots) VALUES
    ('web.home', '/', 'Homepage', 'Blazing Sun - Personal Finance Tracking', 'Track your income, expenses, and financial goals with Blazing Sun. Simple, secure, and powerful personal finance management.', 'index, follow'),
    ('web.sign_up', '/sign-up', 'Sign Up', 'Create Account - Blazing Sun', 'Sign up for a free Blazing Sun account and start tracking your personal finances today.', 'index, follow'),
    ('web.sign_in', '/sign-in', 'Sign In', 'Sign In - Blazing Sun', 'Sign in to your Blazing Sun account to manage your personal finances.', 'index, follow'),
    ('web.forgot_password', '/forgot-password', 'Forgot Password', 'Reset Password - Blazing Sun', 'Reset your Blazing Sun password. We will send you a secure reset link.', 'noindex, follow'),
    ('web.profile', '/profile', 'Profile', 'My Profile - Blazing Sun', 'Manage your Blazing Sun profile, settings, and preferences.', 'noindex, nofollow'),
    ('admin.uploads', '/admin/uploads', 'Uploads Admin', 'Manage Uploads - Blazing Sun Admin', 'Administrative panel for managing uploaded files.', 'noindex, nofollow'),
    ('admin.theme', '/admin/theme', 'Theme Admin', 'Theme Configuration - Blazing Sun Admin', 'Configure site theme, branding, and styling options.', 'noindex, nofollow'),
    ('superadmin.users', '/superadmin/users', 'Users Admin', 'Manage Users - Blazing Sun Admin', 'Super admin panel for managing registered users.', 'noindex, nofollow'),
    ('web.not_found', '/404', '404 Not Found', 'Page Not Found - Blazing Sun', 'The page you are looking for could not be found.', 'noindex, nofollow')
ON CONFLICT (route_name) DO NOTHING;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_page_seo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_page_seo_updated_at ON page_seo;
CREATE TRIGGER trigger_page_seo_updated_at
    BEFORE UPDATE ON page_seo
    FOR EACH ROW
    EXECUTE FUNCTION update_page_seo_updated_at();
