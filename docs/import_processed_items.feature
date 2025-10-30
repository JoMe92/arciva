Feature: Import processed items into a project
  As a user, I want to import already-processed assets into my project and see them immediately so I can begin culling and editing.

  Background:
    Given a project exists
    And I have a list of processed assets (status READY) selected for import

  Scenario: Import links assets and updates UI optimistically
    When I click "Import" with 5 selected items
    Then a request is sent to POST /v1/projects/{project_id}/assets:link with those asset IDs
    And the response contains the 5 items as AssetListItem entries
    And the UI appends these items to the filmstrip without reloading the page
    And the first imported item becomes the main image in the viewer

  Scenario: Duplicate selections are ignored server-side
    Given one of the selected assets is already in the project
    When I click "Import"
    Then the server links only the new assets and ignores duplicates
    And the response includes a duplicates count reflecting the skipped items

  Scenario: Large batch remains responsive
    Given I import 300 items
    When the import completes
    Then the filmstrip updates without freezing the UI
    And the grid/detail view remains interactive during the update

  Scenario: Partial failures surface errors but continue
    Given one selected asset no longer exists
    When I click "Import"
    Then the server responds with 404 and a message listing missing IDs
    And the UI surfaces an error toast without losing current selection state

