"""MicroPython driver for a HD44780 character LCD connected via PCF8574."""

import time

from lcd_api import LcdApi

# Common LCD backpack addresses are usually 0x27 or 0x3F.
DEFAULT_I2C_ADDR = 0x27
FALLBACK_I2C_ADDRS = (0x27, 0x3F)

MASK_RS = 0x01
MASK_RW = 0x02
MASK_E = 0x04
SHIFT_BACKLIGHT = 3
SHIFT_DATA = 4


class I2cLcd(LcdApi):
    """Implements a HD44780 character LCD connected via PCF8574 on I2C."""

    def __init__(self, i2c, i2c_addr, num_lines, num_columns):
        self.i2c = i2c
        self.i2c_addr = i2c_addr
        self.available = False
        self.init_error = None
        self._init_state(num_lines, num_columns)

        try:
            self.i2c_addr = self._resolve_address(i2c_addr)
            self.available = True
            self._write_byte(0)
            time.sleep_ms(20)

            self.hal_write_init_nibble(self.LCD_FUNCTION_RESET)
            time.sleep_ms(5)
            self.hal_write_init_nibble(self.LCD_FUNCTION_RESET)
            time.sleep_ms(1)
            self.hal_write_init_nibble(self.LCD_FUNCTION_RESET)
            time.sleep_ms(1)

            self.hal_write_init_nibble(self.LCD_FUNCTION)
            time.sleep_ms(1)

            super().__init__(num_lines, num_columns)

            cmd = self.LCD_FUNCTION
            if num_lines > 1:
                cmd |= self.LCD_FUNCTION_2LINES
            self.hal_write_command(cmd)
        except OSError as error:
            self.available = False
            self.init_error = error
            print("LCD warning:", error)

    def _init_state(self, num_lines, num_columns):
        self.num_lines = min(num_lines, 4)
        self.num_columns = min(num_columns, 40)
        self.cursor_x = 0
        self.cursor_y = 0
        self.implied_newline = False
        self.backlight = True

    def _resolve_address(self, requested_addr):
        candidates = []
        for addr in (requested_addr,) + FALLBACK_I2C_ADDRS:
            if addr not in candidates:
                candidates.append(addr)

        try:
            scanned = list(self.i2c.scan())
        except Exception:
            scanned = []

        if scanned:
            for addr in candidates:
                if addr in scanned:
                    return addr

        errors = []
        for addr in candidates:
            try:
                self.i2c.writeto(addr, b"\x00")
                return addr
            except OSError as error:
                errors.append((addr, error))

        if scanned:
            found = ", ".join("0x{:02X}".format(addr) for addr in scanned)
            raise OSError("LCD not found at 0x{:02X}. I2C scan found: {}".format(requested_addr, found))

        if errors:
            raise OSError("LCD not responding on I2C. Check SDA/SCL wiring, power, and address (usually 0x27 or 0x3F).")

        raise OSError("LCD not responding on I2C.")

    def _write_byte(self, value):
        if not self.available:
            return
        self.i2c.writeto(self.i2c_addr, bytes([value]))

    def hal_write_init_nibble(self, nibble):
        """Writes an initialization nibble to the LCD."""
        byte = ((nibble >> 4) & 0x0F) << SHIFT_DATA
        self._write_byte(byte | MASK_E)
        self._write_byte(byte)

    def hal_backlight_on(self):
        """Allows the hal layer to turn the backlight on."""
        self._write_byte(1 << SHIFT_BACKLIGHT)

    def hal_backlight_off(self):
        """Allows the hal layer to turn the backlight off."""
        self._write_byte(0)

    def hal_sleep_us(self, usecs):
        """Sleep for some time (given in microseconds)."""
        time.sleep_us(usecs)

    def hal_write_command(self, cmd):
        """Writes a command to the LCD."""
        byte = ((self.backlight << SHIFT_BACKLIGHT) |
                (((cmd >> 4) & 0x0F) << SHIFT_DATA))
        self._write_byte(byte | MASK_E)
        self._write_byte(byte)

        byte = ((self.backlight << SHIFT_BACKLIGHT) |
                ((cmd & 0x0F) << SHIFT_DATA))
        self._write_byte(byte | MASK_E)
        self._write_byte(byte)

        if cmd <= 3:
            time.sleep_ms(5)

    def hal_write_data(self, data):
        """Write data to the LCD."""
        byte = (MASK_RS |
                (self.backlight << SHIFT_BACKLIGHT) |
                (((data >> 4) & 0x0F) << SHIFT_DATA))
        self._write_byte(byte | MASK_E)
        self._write_byte(byte)

        byte = (MASK_RS |
                (self.backlight << SHIFT_BACKLIGHT) |
                ((data & 0x0F) << SHIFT_DATA))
        self._write_byte(byte | MASK_E)
        self._write_byte(byte)
