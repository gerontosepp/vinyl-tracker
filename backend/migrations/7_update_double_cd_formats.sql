-- V7__update_double_cd_formats.sql
-- Update known multi-CD releases in record_cache that were previously stored as 'Double LP'

UPDATE record_cache
SET format = 'Double CD'
WHERE discogs_id IN (
    3064038,   -- Frank Zappa - Joe's Garage Acts I, II & III
    506049,    -- Frank Zappa - You Can't Do That On Stage Anymore Vol. 1
    3082448,   -- Frank Zappa - You Can't Do That On Stage Anymore Vol. 3
    535824,    -- Frank Zappa - You Can't Do That On Stage Anymore Vol. 4
    1380280,   -- Frank Zappa - You Can't Do That On Stage Anymore Vol. 5
    1380281,   -- Frank Zappa - You Can't Do That On Stage Anymore Vol. 6
    27536991,  -- Frank Zappa - Funky Nothingness
    1478480,   -- The Grateful Dead - Two From The Vault
    27544590   -- Charlie Watts - Anthology
);
