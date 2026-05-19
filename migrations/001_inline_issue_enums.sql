-- Convert an existing issue_tracker database to use inline enum columns
-- for issues.status and issues.priority.
--
-- Run this only if your existing database still uses separate status/priority
-- lookup tables or old status_id/priority_id columns.

USE issue_tracker;

ALTER TABLE issues
  ADD COLUMN status_new ENUM('Open', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
  ADD COLUMN priority_new ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium';

UPDATE issues i
LEFT JOIN issue_statuses s ON s.id = i.status_id
LEFT JOIN issue_priorities p ON p.id = i.priority_id
SET
  i.status_new = CASE
    WHEN s.name IN ('Open', 'In Progress', 'Resolved', 'Closed') THEN s.name
    ELSE 'Open'
  END,
  i.priority_new = CASE
    WHEN p.name IN ('Low', 'Medium', 'High') THEN p.name
    ELSE 'Medium'
  END;

ALTER TABLE issues
  DROP FOREIGN KEY fk_issues_status,
  DROP FOREIGN KEY fk_issues_priority;

ALTER TABLE issues
  DROP COLUMN status_id,
  DROP COLUMN priority_id,
  CHANGE COLUMN status_new status ENUM('Open', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
  CHANGE COLUMN priority_new priority ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium';

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_priority ON issues(priority);

DROP TABLE IF EXISTS issue_statuses;
DROP TABLE IF EXISTS issue_priorities;
