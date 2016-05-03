/**
 * Builds the disco floor area on the page.
 */

import {Component, ElementRef} from 'angular2/core';

import {StorageService} from '../services/storage';
import {FloorBuilderService} from '../services/floor_builder';

import {ProgramControllerComponent} from './program_controller';

@Component({
  selector: 'disco-floor',
  templateUrl: './html/disco-floor.html',
  directives: [
    ProgramControllerComponent
   ],
})
export class DiscoFloorComponent {
  // Inject dependencies
  static get parameters() {
    return [
      [ElementRef],
      [StorageService],
      [FloorBuilderService]
    ];
  }

  constructor(elementRef, storageService, floorBuilderService) {
    this._store = storageService;
    this._builder = floorBuilderService;
    this._element = elementRef;
  }

  /**
   * Load floor
   */
  ngOnInit() {
    var settings = this._store.getItem('settings');

    if (settings && settings.dimensions) {
      this.x = settings.dimensions.x;
      this.y = settings.dimensions.y;
      this.cellSize = "100%";

      this._builder.build(this.x * this.y, this.x, this.y);

      // Build Y/X axis for table
      this.tableCells = [];
      for (var i = 0; i < this._builder.cells.length; i++) {
        var cell = this._builder.cells[i],
            y = cell.y,
            x = cell.x;

        this.tableCells[y] = this.tableCells[y] || [];
        this.tableCells[y][x] = cell;
      }
    }
  }

  /**
   * Once the view has been initialized.
   */
  ngAfterViewInit() {
    setTimeout(this.sizeFloor.bind(this), 0);
  }

  /**
   * Set the size of the floor to fit the window while maintain the aspect ratio
   * so all cells are square
   */
  sizeFloor() {
    var component = $(this._element.nativeElement),
        container = component.find('.floor-area'),
        width = container.width(),
        height = container.height(),
        ratio = this.x / this.y,
        size;

    if (!width || !height) {
      return;
    }

    // Set based on width
    if (width > ratio * height) {
      size = ratio * height;
      size = (size > width) ? width : size;
      this.cellSize = Math.floor(size / this.x);
    }
    // Set based on height
    else if (height > width / ratio) {
      size = width / ratio;
      size = (size > height) ? height : size;
      this.cellSize = Math.floor(size / this.y);
    }
  }
}