Feature: Upload initialization and file/folder selection
  As a user, I want to prepare uploads by choosing files or folders and reviewing a lightweight preview list.

  Scenario: Selecting files via picker populates pending list
    Given I open the Data Management import sheet
    When I choose multiple image files from my computer
    Then each chosen file appears in the pending list with its filename
    And I see the file size and a Pending status badge for each item
    And the summary updates with the total selected items and pending bytes

  Scenario: Dragging a folder populates all contained files
    Given I open the import sheet in local upload mode
    When I drag a folder that contains images onto the drop zone
    Then all images inside the folder, including nested subfolders, appear in the pending list
    And each item is grouped under its originating folder path in the sidebar
    And the selection summary reports how many folders are represented

  Scenario: Toggling item selection updates the summary
    Given I have pending items listed for import
    When I uncheck an item from the pending grid
    Then the item visually indicates it is excluded
    And the selected count and pending bytes in the summary decrease accordingly

  Scenario: Large selections remain responsive
    Given I have added at least 2000 images to the pending list
    When I scroll through the list
    Then the UI remains responsive without freezing
    And only the visible portion of the grid renders at once

  Scenario: Uploading shows overall and per-item progress
    Given I have selected pending items and click Start upload
    Then I see an overall progress summary with bytes uploaded and a percentage
    And each item shows its own progress bar and status label while uploading

  Scenario: Pausing and resuming uploads
    Given uploads are in progress
    When I pause all uploads
    Then active uploads move to a paused state and stop advancing
    When I resume all uploads
    Then queued items continue uploading from where they left off

  Scenario: Retrying a failed upload
    Given an upload encounters a network error
    Then the item shows an Error status and a retry action
    When I retry the failed item
    Then the upload resumes without losing previous progress

  Scenario: Cancelling uploads stops remaining work
    Given multiple uploads are active
    When I cancel all uploads
    Then in-progress and queued items switch to Canceled
    And completed uploads remain marked as Completed
