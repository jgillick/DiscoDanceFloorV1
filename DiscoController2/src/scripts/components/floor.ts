/**
 * Builds a visual representation of the dance floor which scales with the page. 
 */

import {Component, ElementRef, OnInit} from 'angular2/core';

import {FloorCell} from '../models/floor_cell';
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
export class DiscoFloorComponent implements OnInit  {
  
  /**
   * The height/width CSS value for each floor cell
   */
  cellSize:any = "100%";
  
  /**
   * The x length of the floor
   */
  x:number = 0;
  
  /**
   * The y length of the floor
   */
  y:number = 0;
  
  /**
   * The table cell grid.
   * A nested array of x and then y.
   */
  tableCells:FloorCell[][] = [];

  constructor(private element:ElementRef, private store:StorageService, private builder:FloorBuilderService) {
  }

  /**
   * Load floor
   */
  ngOnInit() {
    var settings = this.store.getItem('settings');

    if (settings && settings.dimensions) {
      this.x = settings.dimensions.x;
      this.y = settings.dimensions.y;
      this.cellSize = "100%";

      this.builder.build(this.x * this.y, this.x, this.y);

      // Build Y/X axis for table
      this.tableCells = [];
      for (var i = 0; i < this.builder.cells.length; i++) {
        var cell = this.builder.cells[i],
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
    var component = $(this.element.nativeElement),
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
      size = (size > height) ? height : size;
      this.cellSize = Math.floor(size / this.x);
    }
    // Set based on height
    else if (height > width / ratio) {
      size = width / ratio;
      size = (size > width) ? width : size;
      this.cellSize = Math.floor(size / this.y);
    }
  }
}