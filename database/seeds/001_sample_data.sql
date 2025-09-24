-- DataShelf Seed Data
-- Sample navigation and category data for development and testing

-- Insert sample navigation structure (based on typical World of Books categories)
INSERT INTO navigation (id, title, source_url, parent_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Books', 'https://www.worldofbooks.com/en-gb/books', NULL),
    ('550e8400-e29b-41d4-a716-446655440002', 'Fiction', 'https://www.worldofbooks.com/en-gb/books/fiction', '550e8400-e29b-41d4-a716-446655440001'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Non-Fiction', 'https://www.worldofbooks.com/en-gb/books/non-fiction', '550e8400-e29b-41d4-a716-446655440001'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Children''s Books', 'https://www.worldofbooks.com/en-gb/books/childrens', '550e8400-e29b-41d4-a716-446655440001'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Academic & Education', 'https://www.worldofbooks.com/en-gb/books/academic', '550e8400-e29b-41d4-a716-446655440001');

-- Insert fiction subcategories
INSERT INTO navigation (id, title, source_url, parent_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440010', 'Crime & Thriller', 'https://www.worldofbooks.com/en-gb/books/fiction/crime-thriller', '550e8400-e29b-41d4-a716-446655440002'),
    ('550e8400-e29b-41d4-a716-446655440011', 'Romance', 'https://www.worldofbooks.com/en-gb/books/fiction/romance', '550e8400-e29b-41d4-a716-446655440002'),
    ('550e8400-e29b-41d4-a716-446655440012', 'Science Fiction & Fantasy', 'https://www.worldofbooks.com/en-gb/books/fiction/sci-fi-fantasy', '550e8400-e29b-41d4-a716-446655440002'),
    ('550e8400-e29b-41d4-a716-446655440013', 'Literary Fiction', 'https://www.worldofbooks.com/en-gb/books/fiction/literary', '550e8400-e29b-41d4-a716-446655440002');

-- Insert non-fiction subcategories
INSERT INTO navigation (id, title, source_url, parent_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440020', 'Biography & Autobiography', 'https://www.worldofbooks.com/en-gb/books/non-fiction/biography', '550e8400-e29b-41d4-a716-446655440003'),
    ('550e8400-e29b-41d4-a716-446655440021', 'History', 'https://www.worldofbooks.com/en-gb/books/non-fiction/history', '550e8400-e29b-41d4-a716-446655440003'),
    ('550e8400-e29b-41d4-a716-446655440022', 'Science & Nature', 'https://www.worldofbooks.com/en-gb/books/non-fiction/science', '550e8400-e29b-41d4-a716-446655440003'),
    ('550e8400-e29b-41d4-a716-446655440023', 'Self-Help', 'https://www.worldofbooks.com/en-gb/books/non-fiction/self-help', '550e8400-e29b-41d4-a716-446655440003');

-- Insert sample categories linked to navigation
INSERT INTO category (id, navigation_id, title, source_url, product_count) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440010', 'Crime & Thriller', 'https://www.worldofbooks.com/en-gb/books/fiction/crime-thriller', 1250),
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 'Romance', 'https://www.worldofbooks.com/en-gb/books/fiction/romance', 890),
    ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', 'Science Fiction & Fantasy', 'https://www.worldofbooks.com/en-gb/books/fiction/sci-fi-fantasy', 675),
    ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440013', 'Literary Fiction', 'https://www.worldofbooks.com/en-gb/books/fiction/literary', 1100),
    ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440020', 'Biography & Autobiography', 'https://www.worldofbooks.com/en-gb/books/non-fiction/biography', 450),
    ('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440021', 'History', 'https://www.worldofbooks.com/en-gb/books/non-fiction/history', 780),
    ('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440022', 'Science & Nature', 'https://www.worldofbooks.com/en-gb/books/non-fiction/science', 320),
    ('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440023', 'Self-Help', 'https://www.worldofbooks.com/en-gb/books/non-fiction/self-help', 290);

-- Insert sample products with JSONB specs and image URLs
INSERT INTO product (id, category_id, title, source_url, source_id, price, currency, image_urls, summary, specs, available) VALUES
    (
        '770e8400-e29b-41d4-a716-446655440001',
        '660e8400-e29b-41d4-a716-446655440001',
        'The Thursday Murder Club',
        'https://www.worldofbooks.com/en-gb/books/richard-osman/the-thursday-murder-club/9780241988268',
        'WOB123456',
        8.99,
        'GBP',
        '["https://r2.datashelf.com/images/thursday-murder-club-1.jpg", "https://r2.datashelf.com/images/thursday-murder-club-2.jpg"]'::jsonb,
        'In a peaceful retirement village, four unlikely friends meet weekly to investigate cold cases. But when a real murder occurs, they find themselves in the middle of their first live case.',
        '{
            "author": "Richard Osman",
            "isbn": "9780241988268",
            "publisher": "Viking",
            "pages": 336,
            "language": "English",
            "format": "Paperback",
            "publication_date": "2020-09-03",
            "dimensions": "198 x 129 x 21mm",
            "weight": "240g"
        }'::jsonb,
        true
    ),
    (
        '770e8400-e29b-41d4-a716-446655440002',
        '660e8400-e29b-41d4-a716-446655440002',
        'It Ends with Us',
        'https://www.worldofbooks.com/en-gb/books/colleen-hoover/it-ends-with-us/9781501110368',
        'WOB789012',
        9.99,
        'GBP',
        '["https://r2.datashelf.com/images/it-ends-with-us-1.jpg"]'::jsonb,
        'A powerful story about love, courage, and the strength it takes to break the cycle of abuse.',
        '{
            "author": "Colleen Hoover",
            "isbn": "9781501110368",
            "publisher": "Atria Books",
            "pages": 384,
            "language": "English",
            "format": "Paperback",
            "publication_date": "2016-08-02",
            "dimensions": "210 x 140 x 25mm",
            "weight": "320g"
        }'::jsonb,
        true
    ),
    (
        '770e8400-e29b-41d4-a716-446655440003',
        '660e8400-e29b-41d4-a716-446655440003',
        'Dune',
        'https://www.worldofbooks.com/en-gb/books/frank-herbert/dune/9780441172719',
        'WOB345678',
        12.99,
        'GBP',
        '["https://r2.datashelf.com/images/dune-1.jpg", "https://r2.datashelf.com/images/dune-2.jpg", "https://r2.datashelf.com/images/dune-3.jpg"]'::jsonb,
        'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world.',
        '{
            "author": "Frank Herbert",
            "isbn": "9780441172719",
            "publisher": "Ace Books",
            "pages": 688,
            "language": "English",
            "format": "Paperback",
            "publication_date": "1990-08-01",
            "dimensions": "175 x 105 x 35mm",
            "weight": "340g",
            "series": "Dune Chronicles",
            "series_number": 1
        }'::jsonb,
        true
    );

-- Insert sample scrape jobs
INSERT INTO scrape_job (id, type, target_url, status, attempts, metadata) VALUES
    (
        '880e8400-e29b-41d4-a716-446655440001',
        'navigation',
        'https://www.worldofbooks.com/en-gb/books',
        'completed',
        1,
        '{"depth": 0, "priority": "high"}'::jsonb
    ),
    (
        '880e8400-e29b-41d4-a716-446655440002',
        'category',
        'https://www.worldofbooks.com/en-gb/books/fiction/crime-thriller',
        'completed',
        1,
        '{"category_id": "660e8400-e29b-41d4-a716-446655440001", "page": 1}'::jsonb
    ),
    (
        '880e8400-e29b-41d4-a716-446655440003',
        'product',
        'https://www.worldofbooks.com/en-gb/books/richard-osman/the-thursday-murder-club/9780241988268',
        'completed',
        1,
        '{"product_id": "770e8400-e29b-41d4-a716-446655440001"}'::jsonb
    );